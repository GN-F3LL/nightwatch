<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Database\Query\Expression;
use Illuminate\Support\Facades\DB;

/**
 * A dashboard time window split into equal buckets for timeline charts.
 */
class Period
{
    public const OPTIONS = [
        '1h' => 3600,
        '24h' => 86400,
        '7d' => 604800,
        '14d' => 1209600,
        '30d' => 2592000,
    ];

    public const BUCKETS = 60;

    public readonly CarbonImmutable $start;

    public readonly CarbonImmutable $end;

    public readonly int $bucketSeconds;

    public function __construct(public readonly string $key)
    {
        $range = self::OPTIONS[$key];

        $this->bucketSeconds = intdiv($range, self::BUCKETS);

        // Align to bucket boundaries so bars don't shift on every refresh...
        $now = CarbonImmutable::now('UTC');
        $this->end = $now->setTimestamp((intdiv($now->getTimestamp(), $this->bucketSeconds) + 1) * $this->bucketSeconds);
        $this->start = $this->end->subSeconds($range);
    }

    public static function fromRequest(?string $value, string $default = '24h'): self
    {
        return new self(array_key_exists((string) $value, self::OPTIONS) ? $value : $default);
    }

    /**
     * SQL expression yielding the 0-based bucket index of a datetime column.
     */
    public function bucketExpression(string $column): Expression
    {
        $start = $this->start->format('Y-m-d H:i:s');
        $size = $this->bucketSeconds;

        return DB::raw(match (DB::connection()->getDriverName()) {
            'sqlite' => "CAST((julianday({$column}) - julianday('{$start}')) * 86400 / {$size} AS INTEGER)",
            'pgsql' => "FLOOR(EXTRACT(EPOCH FROM ({$column} - TIMESTAMP '{$start}')) / {$size})",
            default => "FLOOR(TIMESTAMPDIFF(SECOND, '{$start}', {$column}) / {$size})",
        });
    }

    /**
     * Expand sparse bucket rows into a dense list of BUCKETS entries.
     *
     * @param  iterable<object>  $rows  rows with a `bucket` property
     * @param  callable(object|null, int): array<string, mixed>  $map
     * @return list<array<string, mixed>>
     */
    public function fill(iterable $rows, callable $map): array
    {
        $byBucket = [];

        foreach ($rows as $row) {
            $byBucket[(int) $row->bucket] = $row;
        }

        $buckets = [];

        for ($i = 0; $i < self::BUCKETS; $i++) {
            $buckets[] = ['at' => $this->start->addSeconds($i * $this->bucketSeconds)->toIso8601String()]
                + $map($byBucket[$i] ?? null, $i);
        }

        return $buckets;
    }

    /**
     * @return array{key: string, start: string, end: string, options: list<string>}
     */
    public function toArray(): array
    {
        return [
            'key' => $this->key,
            'start' => $this->start->toIso8601String(),
            'end' => $this->end->toIso8601String(),
            'options' => array_keys(self::OPTIONS),
        ];
    }
}
