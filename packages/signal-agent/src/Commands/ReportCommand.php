<?php

namespace Signal\Agent\Commands;

use Illuminate\Console\Command;
use Signal\Agent\HostInfo;
use Signal\Agent\Recorder;
use Signal\Agent\Spool;
use Signal\Agent\Transport;

class ReportCommand extends Command
{
    /**
     * Items of one kind per request; matches the dashboard's ingest limit.
     */
    protected const CHUNK = 1000;

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'signal:report';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send server metrics, versions and spooled telemetry to the Signal dashboard';

    /**
     * Execute the console command.
     */
    public function handle(HostInfo $host, Spool $spool, Transport $transport, Recorder $recorder): int
    {
        if (! config('signal-agent.url') || ! config('signal-agent.token')) {
            $this->components->error('Set SIGNAL_URL and SIGNAL_TOKEN in .env first.');

            return self::FAILURE;
        }

        return $recorder->withoutRecording(function () use ($host, $spool, $transport) {
            $items = $spool->drain();
            $batches = $this->batches($items);

            // The first batch carries the host description and a fresh metrics sample...
            $batches[0] = array_filter([
                'host' => $host->stack(),
                'metrics' => [$host->metrics()],
                'certificate' => $host->certificate(),
            ]) + ($batches[0] ?? []);

            foreach ($batches as $i => $batch) {
                $response = $transport->send($batch + ['host' => $host->basic()]);

                if (! $response?->successful()) {
                    // Put back what didn't make it, the snapshot excepted (it's taken again next minute)...
                    foreach (array_slice($batches, $i) as $unsent) {
                        $spool->append(array_diff_key($unsent, ['host' => true, 'metrics' => true, 'certificate' => true]));
                    }

                    $this->components->error('Dashboard unreachable or rejected the report'.($response ? " (HTTP {$response->status()})." : '.'));

                    return self::FAILURE;
                }
            }

            $counts = collect($items)->map(fn ($list) => count($list))->filter();
            $this->components->info('Report sent'.($counts->isNotEmpty() ? ': '.$counts->map(fn ($n, $k) => "{$n} {$k}")->join(', ') : '.'));

            return self::SUCCESS;
        });
    }

    /**
     * Split spooled items into request-sized batches.
     *
     * @param  array<string, list<array<string, mixed>>>  $items
     * @return list<array<string, list<array<string, mixed>>>>
     */
    protected function batches(array $items): array
    {
        $batches = [];

        foreach ($items as $kind => $list) {
            foreach (array_chunk($list, self::CHUNK) as $i => $chunk) {
                $batches[$i][$kind] = $chunk;
            }
        }

        return array_values($batches);
    }
}
