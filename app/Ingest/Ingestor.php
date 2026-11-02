<?php

namespace App\Ingest;

use App\Models\ExceptionGroup;
use App\Models\ExceptionOccurrence;
use App\Models\Host;
use App\Models\HostMetric;
use App\Models\JobRecord;
use App\Models\LogEntry;
use App\Models\Project;
use App\Models\RequestRecord;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class Ingestor
{
    /**
     * Host attributes an agent is allowed to report.
     */
    protected const HOST_ATTRIBUTES = [
        'os_name', 'os_version', 'kernel', 'php_version', 'laravel_version', 'composer_version',
        'node_version', 'database_version', 'web_server', 'cpu_cores', 'uptime_seconds',
    ];

    /**
     * Store one validated agent batch for the given project.
     *
     * @param  array<string, mixed>  $payload
     */
    public function ingest(Project $project, array $payload): void
    {
        DB::transaction(function () use ($project, $payload) {
            $now = now();

            $host = $this->upsertHost($project, $payload['host']);

            $this->storeMetrics($host, $payload['metrics'] ?? []);
            $this->storeExceptions($project, $host, $payload['exceptions'] ?? []);
            $this->storeLogs($project, $host, $payload['logs'] ?? []);
            $this->storeRequests($project, $host, $payload['requests'] ?? []);
            $this->storeJobs($project, $host, $payload['jobs'] ?? []);

            if ($certificate = $payload['certificate'] ?? null) {
                $project->forceFill([
                    'certificate_host' => $certificate['host'],
                    'certificate_issuer' => $certificate['issuer'] ?? null,
                    'certificate_expires_at' => CarbonImmutable::parse($certificate['expires_at'])->utc(),
                ]);
            }

            $project->forceFill(['last_seen_at' => $now])->save();
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function upsertHost(Project $project, array $data): Host
    {
        $host = $project->hosts()->firstOrNew(['hostname' => Str::limit($data['hostname'], 255, '')]);

        // Agents only send what they could detect; never blank out a known value...
        foreach (Arr::only($data, self::HOST_ATTRIBUTES) as $key => $value) {
            if ($value !== null && $value !== '') {
                $host->{$key} = is_string($value) ? Str::limit($value, 255, '') : $value;
            }
        }

        $host->last_seen_at = now();
        $host->save();

        return $host;
    }

    /**
     * @param  array<int, array<string, mixed>>  $metrics
     */
    protected function storeMetrics(Host $host, array $metrics): void
    {
        if ($metrics === []) {
            return;
        }

        $rows = array_map(fn (array $m) => [
            'host_id' => $host->id,
            'cpu_percent' => $this->percent($m['cpu_percent'] ?? null),
            'memory_used' => $this->bytes($m['memory_used'] ?? null),
            'memory_total' => $this->bytes($m['memory_total'] ?? null),
            'disk_used' => $this->bytes($m['disk_used'] ?? null),
            'disk_total' => $this->bytes($m['disk_total'] ?? null),
            'load_1' => isset($m['load'][0]) ? round((float) $m['load'][0], 2) : null,
            'recorded_at' => $this->time($m['recorded_at']),
        ], $metrics);

        HostMetric::insert($rows);

        $latest = collect($metrics)->sortBy('recorded_at')->last();

        $host->forceFill([
            'cpu_percent' => $this->percent($latest['cpu_percent'] ?? null),
            'memory_used' => $this->bytes($latest['memory_used'] ?? null),
            'memory_total' => $this->bytes($latest['memory_total'] ?? null),
            'disk_used' => $this->bytes($latest['disk_used'] ?? null),
            'disk_total' => $this->bytes($latest['disk_total'] ?? null),
            'load_1' => isset($latest['load'][0]) ? round((float) $latest['load'][0], 2) : null,
            'load_5' => isset($latest['load'][1]) ? round((float) $latest['load'][1], 2) : null,
            'load_15' => isset($latest['load'][2]) ? round((float) $latest['load'][2], 2) : null,
        ])->save();
    }

    /**
     * @param  array<int, array<string, mixed>>  $exceptions
     */
    protected function storeExceptions(Project $project, Host $host, array $exceptions): void
    {
        foreach ($exceptions as $e) {
            $class = Str::limit($e['class'], 255, '');
            $file = isset($e['file']) ? Str::limit((string) $e['file'], 255, '') : null;
            $line = isset($e['line']) ? (int) $e['line'] : null;
            $message = (string) ($e['message'] ?? '');
            $occurredAt = $this->time($e['occurred_at']);

            $group = $this->findOrCreateGroup($project, ExceptionGroup::fingerprint($class, $file, $line), [
                'class' => $class,
                'message' => $message,
                'file' => $file,
                'line' => $line,
                'first_seen_at' => $occurredAt,
                'last_seen_at' => $occurredAt,
            ]);

            $updates = ['message' => $message];

            if ($group->last_seen_at === null || $group->last_seen_at->lt($occurredAt)) {
                $updates['last_seen_at'] = $occurredAt;
            }

            // A resolved problem that comes back is a regression...
            if ($group->status === 'resolved') {
                $updates += ['status' => 'unresolved', 'resolved_at' => null, 'regressed_at' => $occurredAt];
            }

            $group->forceFill($updates)->save();
            $group->increment('occurrence_count');

            ExceptionOccurrence::create([
                'exception_group_id' => $group->id,
                'project_id' => $project->id,
                'host_id' => $host->id,
                'message' => $message,
                'handled' => (bool) ($e['handled'] ?? false),
                'trace' => array_slice((array) ($e['trace'] ?? []), 0, 100),
                'code' => $e['code'] ?? null,
                'context' => $e['context'] ?? null,
                'php_version' => $host->php_version,
                'laravel_version' => $host->laravel_version,
                'occurred_at' => $occurredAt,
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    protected function findOrCreateGroup(Project $project, string $fingerprint, array $attributes): ExceptionGroup
    {
        $existing = $project->exceptionGroups()->where('fingerprint', $fingerprint)->first();

        if ($existing) {
            return $existing;
        }

        try {
            return $project->exceptionGroups()->create(['fingerprint' => $fingerprint] + $attributes);
        } catch (UniqueConstraintViolationException) {
            // Another batch created the same group concurrently...
            return $project->exceptionGroups()->where('fingerprint', $fingerprint)->firstOrFail();
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $logs
     */
    protected function storeLogs(Project $project, Host $host, array $logs): void
    {
        $this->insert(LogEntry::class, array_map(fn (array $l) => [
            'project_id' => $project->id,
            'host_id' => $host->id,
            'level' => $l['level'],
            'message' => Str::limit((string) ($l['message'] ?? ''), 10000),
            'context' => empty($l['context']) ? null : json_encode($l['context']),
            'logged_at' => $this->time($l['logged_at']),
        ], $logs));
    }

    /**
     * @param  array<int, array<string, mixed>>  $requests
     */
    protected function storeRequests(Project $project, Host $host, array $requests): void
    {
        $this->insert(RequestRecord::class, array_map(fn (array $r) => [
            'project_id' => $project->id,
            'host_id' => $host->id,
            'method' => strtoupper($r['method']),
            'route' => Str::limit($r['route'], 255, ''),
            'status' => (int) $r['status'],
            'duration_ms' => (int) $r['duration_ms'],
            'recorded_at' => $this->time($r['recorded_at']),
        ], $requests));
    }

    /**
     * @param  array<int, array<string, mixed>>  $jobs
     */
    protected function storeJobs(Project $project, Host $host, array $jobs): void
    {
        $this->insert(JobRecord::class, array_map(fn (array $j) => [
            'project_id' => $project->id,
            'host_id' => $host->id,
            'name' => Str::limit($j['name'], 255, ''),
            'connection' => isset($j['connection']) ? Str::limit((string) $j['connection'], 255, '') : null,
            'queue' => isset($j['queue']) ? Str::limit((string) $j['queue'], 255, '') : null,
            'status' => $j['status'],
            'duration_ms' => (int) $j['duration_ms'],
            'recorded_at' => $this->time($j['recorded_at']),
        ], $jobs));
    }

    /**
     * @param  class-string<Model>  $model
     * @param  array<int, array<string, mixed>>  $rows
     */
    protected function insert(string $model, array $rows): void
    {
        foreach (array_chunk($rows, 500) as $chunk) {
            $model::insert($chunk);
        }
    }

    protected function time(mixed $value): string
    {
        return CarbonImmutable::parse($value)->utc()->format('Y-m-d H:i:s');
    }

    protected function percent(mixed $value): ?float
    {
        return is_numeric($value) ? round(max(0, min(100, (float) $value)), 2) : null;
    }

    protected function bytes(mixed $value): ?int
    {
        return is_numeric($value) ? max(0, (int) $value) : null;
    }
}
