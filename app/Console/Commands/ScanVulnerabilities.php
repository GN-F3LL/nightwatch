<?php

namespace App\Console\Commands;

use App\Security\SecurityReport;
use App\Security\VulnerabilityScanner;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class ScanVulnerabilities extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'signal:scan-vulnerabilities {--force : Also check versions checked within the refresh window}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Look up known vulnerabilities and support status for the versions hosts report';

    /**
     * Execute the console command.
     */
    public function handle(VulnerabilityScanner $scanner): int
    {
        if (! Cache::add(SecurityReport::RUNNING, true, 900)) {
            $this->components->warn('A vulnerability check is already running.');

            return self::SUCCESS;
        }

        try {
            $checked = $scanner->scan((bool) $this->option('force'));
        } finally {
            Cache::forget(SecurityReport::RUNNING);
        }

        $this->components->info("Checked {$checked} component versions.");

        return self::SUCCESS;
    }
}
