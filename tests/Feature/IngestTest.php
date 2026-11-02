<?php

namespace Tests\Feature;

use App\Models\ExceptionGroup;
use App\Models\Project;
use App\Support\HostPresenter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IngestTest extends TestCase
{
    use RefreshDatabase;

    public function test_requests_without_a_valid_token_are_rejected()
    {
        $this->postJson('/api/ingest', $this->payload())->assertUnauthorized();

        $this->withToken('sig_wrong')->postJson('/api/ingest', $this->payload())->assertUnauthorized();
    }

    public function test_a_batch_is_stored_for_the_tokens_project()
    {
        $project = Project::factory()->create();
        $token = $project->issueToken();

        $this->withToken($token)->postJson('/api/ingest', $this->payload())->assertAccepted();

        $host = $project->hosts()->sole();
        $this->assertSame('web-01', $host->hostname);
        $this->assertSame('8.3.12', $host->php_version);
        $this->assertSame('11.31.0', $host->laravel_version);
        $this->assertSame('2.8.2', $host->composer_version);
        $this->assertSame(42.5, $host->cpu_percent);
        $this->assertSame(50.0, $host->memoryPercent());

        $this->assertDatabaseCount('host_metrics', 1);
        $this->assertDatabaseCount('log_entries', 1);
        $this->assertDatabaseCount('request_records', 2);
        $this->assertDatabaseCount('job_records', 1);
        $this->assertDatabaseCount('exception_occurrences', 1);
        $this->assertNotNull($project->fresh()->last_seen_at);
    }

    public function test_stack_versions_and_certificate_are_stored_and_presented()
    {
        $project = Project::factory()->create();
        $token = $project->issueToken();

        $this->withToken($token)->postJson('/api/ingest', array_merge_recursive($this->payload(), [
            'host' => [
                'node_version' => '20.18.1',
                'database_version' => 'mysql 5.5.5-10.11.6-MariaDB-0ubuntu0.24.04.1',
                'web_server' => 'Apache/2.4.58 (Ubuntu)',
            ],
            'certificate' => ['host' => 'app.example.com', 'issuer' => "Let's Encrypt", 'expires_at' => now()->addDays(10)->toIso8601String()],
        ]))->assertAccepted();

        $versions = HostPresenter::present($project->hosts()->sole())['versions'];

        $this->assertSame(['name' => null, 'value' => '20.18.1', 'state' => 'eol'], $versions['node']);
        $this->assertSame(['name' => 'MariaDB', 'value' => '10.11.6', 'state' => 'current'], $versions['database']);
        $this->assertSame(['name' => 'Apache', 'value' => '2.4.58', 'state' => 'current'], $versions['web_server']);

        $certificate = $project->fresh()->certificate();
        $this->assertSame('app.example.com', $certificate['host']);
        $this->assertSame(9, $certificate['days_left']);
    }

    public function test_versions_missing_from_a_batch_keep_their_previous_value()
    {
        $project = Project::factory()->create();
        $token = $project->issueToken();

        $this->withToken($token)->postJson('/api/ingest', $this->payload())->assertAccepted();
        $this->withToken($token)->postJson('/api/ingest', ['host' => ['hostname' => 'web-01', 'composer_version' => null]])->assertAccepted();

        $this->assertSame('2.8.2', $project->hosts()->sole()->composer_version);
    }

    public function test_repeated_exceptions_are_grouped_and_resolved_ones_regress()
    {
        $project = Project::factory()->create();
        $token = $project->issueToken();

        $this->withToken($token)->postJson('/api/ingest', $this->payload())->assertAccepted();

        $group = ExceptionGroup::sole();
        $group->update(['status' => 'resolved', 'resolved_at' => now()]);

        $this->withToken($token)->postJson('/api/ingest', $this->payload())->assertAccepted();

        $group->refresh();
        $this->assertSame(2, $group->occurrence_count);
        $this->assertSame('unresolved', $group->status);
        $this->assertNotNull($group->regressed_at);
        $this->assertDatabaseCount('exception_groups', 1);
    }

    public function test_invalid_items_are_rejected()
    {
        $project = Project::factory()->create();

        $this->withToken($project->issueToken())
            ->postJson('/api/ingest', ['host' => ['hostname' => 'web-01'], 'logs' => [['level' => 'loud', 'message' => 'x', 'logged_at' => now()->toIso8601String()]]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('logs.0.level');
    }

    /**
     * @return array<string, mixed>
     */
    protected function payload(): array
    {
        $now = now()->toIso8601String();

        return [
            'host' => [
                'hostname' => 'web-01',
                'os_name' => 'Ubuntu',
                'os_version' => '24.04',
                'php_version' => '8.3.12',
                'laravel_version' => '11.31.0',
                'composer_version' => '2.8.2',
                'cpu_cores' => 4,
            ],
            'metrics' => [[
                'cpu_percent' => 42.5,
                'memory_used' => 4_000_000_000,
                'memory_total' => 8_000_000_000,
                'disk_used' => 40_000_000_000,
                'disk_total' => 80_000_000_000,
                'load' => [1.2, 1.1, 0.9],
                'recorded_at' => $now,
            ]],
            'exceptions' => [[
                'class' => 'RuntimeException',
                'message' => 'Something broke',
                'file' => 'app/Jobs/SyncInvoices.php',
                'line' => 64,
                'handled' => false,
                'trace' => [['file' => 'app/Jobs/SyncInvoices.php', 'line' => 64, 'function' => 'handle', 'class' => 'App\Jobs\SyncInvoices', 'app' => true]],
                'context' => ['job' => ['name' => 'App\Jobs\SyncInvoices']],
                'occurred_at' => $now,
            ]],
            'logs' => [['level' => 'error', 'message' => 'Payment failed', 'context' => ['order' => 5], 'logged_at' => $now]],
            'requests' => [
                ['method' => 'GET', 'route' => '/api/invoices', 'status' => 200, 'duration_ms' => 120, 'recorded_at' => $now],
                ['method' => 'POST', 'route' => '/api/invoices', 'status' => 500, 'duration_ms' => 900, 'recorded_at' => $now],
            ],
            'jobs' => [['name' => 'App\Jobs\SyncInvoices', 'queue' => 'default', 'connection' => 'redis', 'status' => 'failed', 'duration_ms' => 300, 'recorded_at' => $now]],
        ];
    }
}
