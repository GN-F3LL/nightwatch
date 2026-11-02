<?php

namespace App\Console\Commands;

use App\Models\ExceptionOccurrence;
use App\Models\HostMetric;
use App\Models\JobRecord;
use App\Models\LogEntry;
use App\Models\RequestRecord;
use Illuminate\Console\Command;

class PruneTelemetry extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'signal:prune {--days= : Keep this many days instead of the configured retention}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Delete telemetry older than the retention period';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $days = (int) ($this->option('days') ?? config('signal.retention_days'));
        $cutoff = now()->subDays($days);

        $tables = [
            [HostMetric::class, 'recorded_at'],
            [RequestRecord::class, 'recorded_at'],
            [JobRecord::class, 'recorded_at'],
            [LogEntry::class, 'logged_at'],
            [ExceptionOccurrence::class, 'occurred_at'],
        ];

        foreach ($tables as [$model, $column]) {
            $deleted = 0;

            // Delete in chunks to keep locks short on large tables...
            do {
                $batch = $model::where($column, '<', $cutoff)->limit(5000)->delete();
                $deleted += $batch;
            } while ($batch > 0);

            $this->components->twoColumnDetail(class_basename($model), number_format($deleted).' deleted');
        }

        return self::SUCCESS;
    }
}
