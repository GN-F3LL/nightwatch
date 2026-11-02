<?php

namespace Signal\Agent;

use Illuminate\Contracts\Foundation\Application;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Collects telemetry during one request, job or command and hands it off when it ends.
 */
class Recorder
{
    protected const LEVELS = ['debug' => 0, 'info' => 1, 'notice' => 2, 'warning' => 3, 'error' => 4, 'critical' => 5, 'alert' => 6, 'emergency' => 7];

    /** @var list<array<string, mixed>> */
    protected array $exceptions = [];

    /** @var list<array<string, mixed>> */
    protected array $logs = [];

    /** @var list<array<string, mixed>> */
    protected array $requests = [];

    /** @var list<array<string, mixed>> */
    protected array $jobs = [];

    /** @var array<string, float> */
    protected array $jobStarts = [];

    /** @var array<string, mixed>|null */
    protected ?array $currentJob = null;

    protected ?string $currentCommand = null;

    /** Set while the agent itself is talking to the dashboard, to ignore its own noise. */
    protected bool $paused = false;

    public function __construct(
        protected Application $app,
        protected ExceptionSerializer $serializer,
        protected Spool $spool,
        protected Transport $transport,
        protected HostInfo $host,
    ) {
        //
    }

    public function recordException(Throwable $e): void
    {
        if ($this->paused || ! config('signal-agent.capture.exceptions')) {
            return;
        }

        foreach ((array) config('signal-agent.ignore_exceptions') as $ignored) {
            if ($e instanceof $ignored) {
                return;
            }
        }

        try {
            $this->exceptions[] = $this->serializer->serialize($e) + [
                'handled' => false,
                'context' => $this->context(),
                'occurred_at' => $this->now(),
            ];
        } catch (Throwable) {
            // Never let serialisation problems surface in the app...
        }
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public function recordLog(string $level, mixed $message, array $context): void
    {
        $level = strtolower($level);
        $minimum = self::LEVELS[strtolower((string) config('signal-agent.log_level'))] ?? 1;

        if ($this->paused || ! config('signal-agent.capture.logs') || (self::LEVELS[$level] ?? 0) < $minimum) {
            return;
        }

        $this->logs[] = [
            'level' => $level,
            'message' => Str::limit(is_string($message) ? $message : json_encode($message), 10000),
            'context' => $this->normalize($context),
            'logged_at' => $this->now(),
        ];

        $this->persistIfFull();
    }

    public function recordRequest(Request $request, Response $response): void
    {
        if ($this->paused) {
            return;
        }

        $this->host->rememberServerSoftware($request->server('SERVER_SOFTWARE'));

        if (! config('signal-agent.capture.requests')) {
            return;
        }

        // Exceptions that ended in a non-5xx response were dealt with by the app...
        if ($response->getStatusCode() < 500) {
            $this->markExceptionsHandled();
        }

        if ($request->is(...(array) config('signal-agent.ignore_paths'))) {
            return;
        }

        $rate = (float) config('signal-agent.request_sample_rate');

        if ($rate < 1 && mt_rand() / mt_getrandmax() > $rate) {
            return;
        }

        $start = $request->server('REQUEST_TIME_FLOAT') ?: (defined('LARAVEL_START') ? LARAVEL_START : microtime(true));
        $route = $request->route();

        $this->requests[] = [
            'method' => $request->getMethod(),
            'route' => $route ? '/'.ltrim($route->uri(), '/') : '[unmatched]',
            'status' => $response->getStatusCode(),
            'duration_ms' => (int) max(0, round((microtime(true) - (float) $start) * 1000)),
            'recorded_at' => $this->now(),
        ];

        $this->persistIfFull();
    }

    public function jobStarted(Job $job, string $connection): void
    {
        $this->jobStarts[$this->jobKey($job)] = microtime(true);

        $this->currentJob = [
            'name' => $job->resolveName(),
            'queue' => $job->getQueue(),
            'connection' => $connection,
            'attempt' => $job->attempts(),
        ];
    }

    /**
     * @param  'processed'|'released'|'failed'  $status
     */
    public function jobFinished(Job $job, string $connection, string $status): void
    {
        $key = $this->jobKey($job);
        $started = $this->jobStarts[$key] ?? null;
        unset($this->jobStarts[$key]);

        if ($status === 'processed') {
            $this->markExceptionsHandled();
        }

        if (config('signal-agent.capture.jobs')) {
            $this->jobs[] = [
                'name' => $job->resolveName(),
                'connection' => $connection,
                'queue' => $job->getQueue(),
                'status' => $status,
                'duration_ms' => $started ? (int) round((microtime(true) - $started) * 1000) : 0,
                'recorded_at' => $this->now(),
            ];
        }

        // Workers are long-lived; hand off after every job instead of at shutdown...
        $this->persist();
        $this->currentJob = null;
    }

    public function commandStarted(?string $command): void
    {
        $this->currentCommand = $command;
    }

    /**
     * Send exceptions now and spool everything else for the next `signal:report`.
     */
    public function persist(): void
    {
        $exceptions = $this->exceptions;
        $spooled = ['logs' => $this->logs, 'requests' => $this->requests, 'jobs' => $this->jobs];

        $this->exceptions = $this->logs = $this->requests = $this->jobs = [];

        if ($exceptions !== []) {
            $response = $this->withoutRecording(fn () => $this->transport->send(['host' => $this->host->basic(), 'exceptions' => $exceptions]));

            if (! $response?->successful()) {
                $spooled['exceptions'] = $exceptions;
            }
        }

        $this->spool->append($spooled);
    }

    /**
     * Run a callback without recording the logs or exceptions it produces.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function withoutRecording(callable $callback): mixed
    {
        $paused = $this->paused;
        $this->paused = true;

        try {
            return $callback();
        } finally {
            $this->paused = $paused;
        }
    }

    protected function persistIfFull(): void
    {
        if (count($this->logs) + count($this->requests) >= 500) {
            $this->persist();
        }
    }

    protected function markExceptionsHandled(): void
    {
        foreach ($this->exceptions as &$exception) {
            $exception['handled'] = true;
        }
    }

    /**
     * Where the exception happened: the request, job or command being run.
     *
     * @return array<string, array<string, mixed>>
     */
    protected function context(): array
    {
        $context = [];

        if ($this->currentJob) {
            $context['job'] = $this->currentJob;
        } elseif ($this->app->runningInConsole()) {
            $context['command'] = ['name' => $this->currentCommand ?? 'artisan'];
        } elseif ($this->app->bound('request')) {
            $request = $this->app->make('request');

            $context['request'] = array_filter([
                'method' => $request->getMethod(),
                'url' => $request->url(),
                'route' => $request->route()?->uri(),
                'action' => $request->route()?->getActionName(),
            ]);

            try {
                if ($id = $this->app->make('auth')->id()) {
                    $context['user'] = ['id' => $id];
                }
            } catch (Throwable) {
                //
            }
        }

        return $context;
    }

    /**
     * Make log context JSON-safe and small.
     */
    protected function normalize(mixed $value, int $depth = 0): mixed
    {
        if ($value instanceof Throwable) {
            return get_class($value).': '.Str::limit($value->getMessage(), 500);
        }

        if (is_array($value)) {
            if ($depth >= 3) {
                return '[array]';
            }

            return array_map(fn ($v) => $this->normalize($v, $depth + 1), array_slice($value, 0, 50, true));
        }

        if (is_object($value)) {
            return method_exists($value, '__toString') ? Str::limit((string) $value, 500) : '['.get_class($value).']';
        }

        return is_string($value) ? Str::limit($value, 1000) : $value;
    }

    protected function jobKey(Job $job): string
    {
        return (string) ($job->getJobId() ?? spl_object_id($job));
    }

    protected function now(): string
    {
        return now()->toIso8601ZuluString('microsecond');
    }

    /**
     * @return array<string, int>
     */
    public function pending(): array
    {
        return array_map('count', ['exceptions' => $this->exceptions, 'logs' => $this->logs, 'requests' => $this->requests, 'jobs' => $this->jobs]);
    }
}
