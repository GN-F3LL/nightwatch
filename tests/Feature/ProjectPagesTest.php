<?php

namespace Tests\Feature;

use App\Models\ExceptionGroup;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProjectPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_a_project_reveals_its_token_once()
    {
        $this->actingAs(User::factory()->create());

        $response = $this->post('/projects', ['name' => 'Billing API', 'environment' => 'production']);

        $project = Project::sole();
        $response->assertRedirect("/projects/{$project->slug}/setup");

        $this->followRedirects($response)->assertInertia(fn (Assert $page) => $page
            ->component('projects/setup')
            ->where('token', fn ($token) => Project::findByToken($token)?->is($project)));

        $this->get("/projects/{$project->slug}/setup")->assertInertia(fn (Assert $page) => $page->where('token', null));
    }

    public function test_every_page_renders_with_telemetry()
    {
        $this->actingAs(User::factory()->create());

        $project = Project::factory()->create();
        $token = $project->issueToken();

        $this->withToken($token)->postJson('/api/ingest', [
            'host' => ['hostname' => 'web-01', 'php_version' => '8.3.12', 'laravel_version' => '11.31.0'],
            'metrics' => [['cpu_percent' => 30, 'memory_used' => 1, 'memory_total' => 2, 'recorded_at' => now()->toIso8601String()]],
            'exceptions' => [['class' => 'RuntimeException', 'message' => 'boom', 'file' => 'app/A.php', 'line' => 1, 'occurred_at' => now()->toIso8601String()]],
            'logs' => [['level' => 'warning', 'message' => 'careful', 'logged_at' => now()->toIso8601String()]],
            'requests' => [['method' => 'GET', 'route' => '/', 'status' => 200, 'duration_ms' => 15, 'recorded_at' => now()->toIso8601String()]],
            'jobs' => [['name' => 'App\Jobs\Ping', 'status' => 'processed', 'duration_ms' => 5, 'recorded_at' => now()->toIso8601String()]],
        ])->assertAccepted();

        $group = ExceptionGroup::sole();

        $this->get('/projects')->assertInertia(fn (Assert $page) => $page->component('projects/index')->has('projects', 1));
        $this->get('/hosts')->assertInertia(fn (Assert $page) => $page->component('hosts/index')->has('hosts', 1));

        $this->get("/projects/{$project->slug}?period=1h")->assertInertia(fn (Assert $page) => $page
            ->component('projects/show')
            ->where('requests.total', 1)
            ->where('jobs.counts.processed', 1)
            ->where('exceptions.counts.unhandled', 1)
            ->has('requests.buckets', 60)
            ->has('routes', 1)
            ->where('routes.0.p95_ms', 15));

        $this->get("/projects/{$project->slug}/requests")->assertInertia(fn (Assert $page) => $page->component('requests/index')->has('routes', 1));
        $this->get("/projects/{$project->slug}/jobs")->assertInertia(fn (Assert $page) => $page->component('jobs/index')->has('jobs', 1));
        $this->get("/projects/{$project->slug}/logs")->assertInertia(fn (Assert $page) => $page->component('logs/index')->has('entries.data', 1));
        $this->get("/projects/{$project->slug}/exceptions")->assertInertia(fn (Assert $page) => $page
            ->component('exceptions/index')
            ->has('groups.data', 1)
            ->where('groups.data.0.trend.13', 1));
        $this->get("/projects/{$project->slug}/exceptions/{$group->id}")->assertInertia(fn (Assert $page) => $page->component('exceptions/show'));
    }

    public function test_the_projects_table_gets_a_24_hour_request_trend()
    {
        $this->actingAs(User::factory()->create());

        $project = Project::factory()->create();
        $request = fn ($status, $at) => ['method' => 'GET', 'route' => '/', 'status' => $status, 'duration_ms' => 5, 'recorded_at' => $at->toIso8601String()];

        $this->withToken($project->issueToken())->postJson('/api/ingest', [
            'host' => ['hostname' => 'web-01'],
            'requests' => [$request(200, now()), $request(500, now()), $request(200, now()->subHours(23)), $request(200, now()->subDays(2))],
        ])->assertAccepted();

        $this->get('/projects')->assertInertia(fn (Assert $page) => $page
            ->has('projects.0.requests_trend', 30)
            ->where('projects.0.requests_trend.29', [2, 1])
            ->where('projects.0.requests_24h', 3)
            ->where('projects.0.requests_trend', fn ($trend) => collect($trend)->sum(0) === 3));
    }

    public function test_exception_groups_can_be_resolved()
    {
        $this->actingAs(User::factory()->create());

        $project = Project::factory()->create();
        $group = $project->exceptionGroups()->create([
            'fingerprint' => sha1('x'), 'class' => 'E', 'message' => 'm', 'first_seen_at' => now(), 'last_seen_at' => now(),
        ]);

        $this->patch("/projects/{$project->slug}/exceptions/{$group->id}", ['status' => 'resolved'])->assertRedirect();

        $this->assertSame('resolved', $group->fresh()->status);
        $this->assertNotNull($group->fresh()->resolved_at);
    }

    public function test_exceptions_of_another_project_are_not_reachable()
    {
        $this->actingAs(User::factory()->create());

        [$mine, $theirs] = Project::factory()->count(2)->create();
        $group = $theirs->exceptionGroups()->create([
            'fingerprint' => sha1('x'), 'class' => 'E', 'message' => 'm', 'first_seen_at' => now(), 'last_seen_at' => now(),
        ]);

        $this->get("/projects/{$mine->slug}/exceptions/{$group->id}")->assertNotFound();
    }

    public function test_registration_closes_after_the_first_user()
    {
        $this->get('/register')->assertOk();

        User::factory()->create();

        $this->get('/register')->assertRedirect('/login');
    }
}
