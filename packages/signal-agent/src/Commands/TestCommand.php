<?php

namespace Signal\Agent\Commands;

use Illuminate\Console\Command;
use RuntimeException;
use Signal\Agent\ExceptionSerializer;
use Signal\Agent\HostInfo;
use Signal\Agent\Transport;

class TestCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'signal:test';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check the connection to the Signal dashboard and send a test exception';

    /**
     * Execute the console command.
     */
    public function handle(HostInfo $host, Transport $transport, ExceptionSerializer $serializer): int
    {
        if (! config('signal-agent.url') || ! config('signal-agent.token')) {
            $this->components->error('Set SIGNAL_URL and SIGNAL_TOKEN in .env first.');

            return self::FAILURE;
        }

        $stack = $host->stack();
        $metrics = $host->metrics();
        $certificate = $host->certificate();

        $this->components->twoColumnDetail('Dashboard', config('signal-agent.url'));
        $this->components->twoColumnDetail('Host', $stack['hostname']);
        $this->components->twoColumnDetail('OS', trim($stack['os_name'].' '.$stack['os_version']));
        $this->components->twoColumnDetail('PHP / Laravel', "{$stack['php_version']} / {$stack['laravel_version']}");
        $this->components->twoColumnDetail('Composer', $stack['composer_version'] ?? '<fg=yellow>not detected</>');
        $this->components->twoColumnDetail('Node', $stack['node_version'] ?? '<fg=yellow>not detected</>');
        $this->components->twoColumnDetail('Database', $stack['database_version'] ?? '<fg=yellow>not detected</>');
        $this->components->twoColumnDetail('Web server', $stack['web_server'] ?? '<fg=yellow>not detected yet: open a page of the app</>');
        $this->components->twoColumnDetail('CPU / RAM / disk', implode(' / ', [
            $metrics['cpu_percent'] === null ? 'n/a' : "{$metrics['cpu_percent']}%",
            $metrics['memory_total'] ? round($metrics['memory_used'] / $metrics['memory_total'] * 100).'%' : 'n/a',
            $metrics['disk_total'] ? round($metrics['disk_used'] / $metrics['disk_total'] * 100).'%' : 'n/a',
        ]));
        $this->components->twoColumnDetail('SSL certificate', $certificate
            ? "{$certificate['host']} · expires {$certificate['expires_at']}"
            : '<fg=yellow>none: APP_URL is not https (set SIGNAL_CERTIFICATE_URL to check another URL)</>');

        $exception = $serializer->serialize(new RuntimeException('This is a test exception from signal:test.'));

        $response = $transport->send(array_filter([
            'host' => $stack,
            'metrics' => [$metrics],
            'certificate' => $certificate,
            'exceptions' => [$exception + ['handled' => true, 'context' => ['command' => ['name' => 'signal:test']], 'occurred_at' => now()->toIso8601ZuluString()]],
            'logs' => [['level' => 'info', 'message' => 'signal:test connection check', 'context' => [], 'logged_at' => now()->toIso8601ZuluString()]],
        ]));

        if (! $response) {
            $this->components->error('Could not reach the dashboard. Check SIGNAL_URL and that this server can connect to it.');

            return self::FAILURE;
        }

        if (! $response->successful()) {
            $this->components->error("The dashboard answered HTTP {$response->status()}: ".($response->json('message') ?? $response->body()));

            return self::FAILURE;
        }

        $this->components->info('Connected. A test exception and log entry were sent.');

        return self::SUCCESS;
    }
}
