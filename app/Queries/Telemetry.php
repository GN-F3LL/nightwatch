<?php

namespace App\Queries;

use App\Models\ExceptionGroup;
use App\Models\ExceptionOccurrence;
use App\Models\HostMetric;
use App\Models\JobRecord;
use App\Models\Project;
use App\Models\RequestRecord;
use App\Support\Period;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Aggregations behind the project dashboard, requests and jobs pages.
 */
class Telemetry
{
    public function __construct(protected Project $project, protected Period $period)
    {
        //
    }

    /**
     * Requests per bucket, split by status class.
     *
     * @return array{total: int, counts: array<string, int>, buckets: list<array<string, mixed>>}
     */
    public function requestTimeline(): array
    {
        $rows = $this->window(RequestRecord::query(), 'recorded_at')
            ->select([
                DB::raw($this->bucket('recorded_at').' as bucket'),
                DB::raw('SUM(CASE WHEN status < 400 THEN 1 ELSE 0 END) as ok'),
                DB::raw('SUM(CASE WHEN status BETWEEN 400 AND 499 THEN 1 ELSE 0 END) as client'),
                DB::raw('SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) as server'),
            ])
            ->groupBy('bucket')
            ->get();

        return $this->timeline($rows, ['ok', 'client', 'server']);
    }

    /**
     * Jobs per bucket, split by outcome.
     *
     * @return array{total: int, counts: array<string, int>, buckets: list<array<string, mixed>>}
     */
    public function jobTimeline(): array
    {
        $rows = $this->window(JobRecord::query(), 'recorded_at')
            ->select([
                DB::raw($this->bucket('recorded_at').' as bucket'),
                DB::raw("SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processed"),
                DB::raw("SUM(CASE WHEN status = 'released' THEN 1 ELSE 0 END) as released"),
                DB::raw("SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed"),
            ])
            ->groupBy('bucket')
            ->get();

        return $this->timeline($rows, ['processed', 'released', 'failed']);
    }

    /**
     * Exception occurrences per bucket, split by handled / unhandled.
     *
     * @return array{total: int, counts: array<string, int>, buckets: list<array<string, mixed>>}
     */
    public function exceptionTimeline(): array
    {
        $rows = $this->window(ExceptionOccurrence::query(), 'occurred_at')
            ->select([
                DB::raw($this->bucket('occurred_at').' as bucket'),
                DB::raw('SUM(CASE WHEN handled = 1 THEN 1 ELSE 0 END) as handled'),
                DB::raw('SUM(CASE WHEN handled = 1 THEN 0 ELSE 1 END) as unhandled'),
            ])
            ->groupBy('bucket')
            ->get();

        return $this->timeline($rows, ['handled', 'unhandled']);
    }

    /**
     * Average CPU usage across the project's hosts per bucket.
     *
     * @return array{buckets: list<array<string, mixed>>}
     */
    public function cpuTimeline(): array
    {
        $rows = HostMetric::query()
            ->whereIn('host_id', $this->project->hosts()->select('id'))
            ->where('recorded_at', '>=', $this->period->start)
            ->where('recorded_at', '<', $this->period->end)
            ->select([
                DB::raw($this->bucket('recorded_at').' as bucket'),
                DB::raw('AVG(cpu_percent) as cpu'),
                DB::raw('AVG(CASE WHEN memory_total > 0 THEN memory_used * 100.0 / memory_total END) as memory'),
            ])
            ->groupBy('bucket')
            ->get();

        return [
            'buckets' => $this->period->fill($rows, fn ($row) => [
                'cpu' => $row?->cpu !== null ? round((float) $row->cpu, 1) : null,
                'memory' => $row?->memory !== null ? round((float) $row->memory, 1) : null,
            ]),
        ];
    }

    /**
     * Per-route statistics, slowest p95 first.
     *
     * @return list<array<string, mixed>>
     */
    public function routes(int $limit = 10): array
    {
        $routes = $this->window(RequestRecord::query(), 'recorded_at')
            ->select([
                'method', 'route',
                DB::raw('COUNT(*) as calls'),
                DB::raw('SUM(CASE WHEN status BETWEEN 400 AND 499 THEN 1 ELSE 0 END) as client_errors'),
                DB::raw('SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) as server_errors'),
                DB::raw('AVG(duration_ms) as avg_ms'),
                DB::raw('MAX(duration_ms) as max_ms'),
            ])
            ->groupBy('method', 'route')
            ->orderByDesc('avg_ms')
            ->limit($limit)
            ->get();

        return $routes
            ->map(fn ($r) => [
                'method' => $r->method,
                'route' => $r->route,
                'calls' => (int) $r->calls,
                'client_errors' => (int) $r->client_errors,
                'server_errors' => (int) $r->server_errors,
                'avg_ms' => (int) round((float) $r->avg_ms),
                'max_ms' => (int) $r->max_ms,
                'p95_ms' => $this->percentile(
                    $this->window(RequestRecord::query(), 'recorded_at')->where('method', $r->method)->where('route', $r->route),
                    (int) $r->calls,
                ),
            ])
            ->sortByDesc('p95_ms')
            ->values()
            ->all();
    }

    /**
     * Per-job-class statistics, most failures first.
     *
     * @return list<array<string, mixed>>
     */
    public function jobs(int $limit = 50): array
    {
        return $this->window(JobRecord::query(), 'recorded_at')
            ->select([
                'name',
                DB::raw('COUNT(*) as attempts'),
                DB::raw("SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processed"),
                DB::raw("SUM(CASE WHEN status = 'released' THEN 1 ELSE 0 END) as released"),
                DB::raw("SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed"),
                DB::raw('AVG(duration_ms) as avg_ms'),
                DB::raw('MAX(duration_ms) as max_ms'),
                DB::raw('MAX(queue) as queue'),
            ])
            ->groupBy('name')
            ->orderByDesc('failed')
            ->orderByDesc('attempts')
            ->limit($limit)
            ->get()
            ->map(fn ($j) => [
                'name' => $j->name,
                'queue' => $j->queue,
                'attempts' => (int) $j->attempts,
                'processed' => (int) $j->processed,
                'released' => (int) $j->released,
                'failed' => (int) $j->failed,
                'avg_ms' => (int) round((float) $j->avg_ms),
                'max_ms' => (int) $j->max_ms,
            ])
            ->all();
    }

    /**
     * Exception groups with the most occurrences in the window.
     *
     * @return list<array<string, mixed>>
     */
    public function topExceptions(int $limit = 6): array
    {
        $counts = $this->window(ExceptionOccurrence::query(), 'occurred_at')
            ->select('exception_group_id', DB::raw('COUNT(*) as events'))
            ->groupBy('exception_group_id')
            ->orderByDesc('events')
            ->limit($limit)
            ->pluck('events', 'exception_group_id');

        return ExceptionGroup::whereKey($counts->keys())
            ->get()
            ->map(fn (ExceptionGroup $g) => [
                'id' => $g->id,
                'class' => $g->class,
                'message' => $g->message,
                'status' => $g->status,
                'events' => (int) $counts[$g->id],
                'last_seen_at' => $g->last_seen_at->toIso8601String(),
            ])
            ->sortByDesc('events')
            ->values()
            ->all();
    }

    /**
     * Value at the given percentile of duration_ms for a filtered query.
     */
    protected function percentile(Builder $query, int $count, float $percentile = 0.95): ?int
    {
        if ($count === 0) {
            return null;
        }

        $value = $query->orderBy('duration_ms')
            ->offset(max(0, (int) ceil($count * $percentile) - 1))
            ->limit(1)
            ->value('duration_ms');

        return $value === null ? null : (int) $value;
    }

    /**
     * Scope a query to this project and period.
     */
    protected function window(Builder $query, string $column): Builder
    {
        return $query
            ->where('project_id', $this->project->id)
            ->where($column, '>=', $this->period->start)
            ->where($column, '<', $this->period->end);
    }

    protected function bucket(string $column): string
    {
        return $this->period->bucketExpression($column)->getValue(DB::connection()->getQueryGrammar());
    }

    /**
     * @param  Collection<int, object>  $rows
     * @param  list<string>  $series
     * @return array{total: int, counts: array<string, int>, buckets: list<array<string, mixed>>}
     */
    protected function timeline($rows, array $series): array
    {
        $counts = array_fill_keys($series, 0);

        foreach ($rows as $row) {
            foreach ($series as $name) {
                $counts[$name] += (int) $row->{$name};
            }
        }

        return [
            'total' => array_sum($counts),
            'counts' => $counts,
            'buckets' => $this->period->fill($rows, fn ($row) => [
                'values' => array_map(fn ($name) => (int) ($row?->{$name} ?? 0), $series),
            ]),
        ];
    }
}
