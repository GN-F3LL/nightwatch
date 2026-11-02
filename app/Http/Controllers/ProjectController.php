<?php

namespace App\Http\Controllers;

use App\Models\Host;
use App\Models\Project;
use App\Models\RequestRecord;
use App\Queries\Telemetry;
use App\Security\SecurityReport;
use App\Support\HostPresenter;
use App\Support\Period;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    /**
     * Bars in the requests sparkline of the projects table; two dashboard buckets each.
     */
    protected const TREND_BARS = 30;

    /**
     * All projects with their health at a glance.
     */
    public function index(): Response
    {
        $since = now()->subDay();

        $projects = Project::query()
            ->with('hosts')
            ->withCount([
                'exceptionOccurrences as exceptions_24h' => fn ($q) => $q->where('occurred_at', '>=', $since),
                'exceptionGroups as exception_groups_24h' => fn ($q) => $q->where('last_seen_at', '>=', $since),
                'requestRecords as requests_24h' => fn ($q) => $q->where('recorded_at', '>=', $since),
                'requestRecords as server_errors_24h' => fn ($q) => $q->where('recorded_at', '>=', $since)->where('status', '>=', 500),
                'exceptionGroups as unresolved_exceptions' => fn ($q) => $q->where('status', 'unresolved'),
            ])
            ->orderBy('name')
            ->get();

        $latest = HostPresenter::latestVersions(Host::all());
        $components = SecurityReport::components();
        $security = SecurityReport::byProject($components);
        $trends = $this->requestTrends();

        return Inertia::render('projects/index', [
            'security' => SecurityReport::summary($components),
            'projects' => $projects->map(fn (Project $project) => [
                'id' => $project->id,
                'name' => $project->name,
                'slug' => $project->slug,
                'environment' => $project->environment,
                'last_seen_at' => $project->last_seen_at?->toIso8601String(),
                'certificate' => $project->certificate(),
                'security' => $security[$project->slug] ?? null,
                'exceptions_24h' => $project->exceptions_24h,
                'exception_groups_24h' => $project->exception_groups_24h,
                'requests_24h' => $project->requests_24h,
                'server_errors_24h' => $project->server_errors_24h,
                'unresolved_exceptions' => $project->unresolved_exceptions,
                'requests_trend' => $trends[$project->id] ?? array_fill(0, self::TREND_BARS, [0, 0]),
                'hosts' => $project->hosts->map(fn (Host $host) => HostPresenter::present($host, $latest))->values(),
            ]),
        ]);
    }

    /**
     * Requests and server errors over the last 24 hours, as [total, 5xx] pairs per bar, keyed by project id.
     *
     * @return array<int, list<array{0: int, 1: int}>>
     */
    protected function requestTrends(): array
    {
        $period = new Period('24h');
        $bucket = $period->bucketExpression('recorded_at')->getValue(DB::connection()->getQueryGrammar());
        $trends = [];

        $rows = RequestRecord::query()
            ->where('recorded_at', '>=', $period->start)
            ->where('recorded_at', '<', $period->end)
            ->select([
                'project_id',
                DB::raw("{$bucket} as bucket"),
                DB::raw('COUNT(*) as total'),
                DB::raw('SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) as errors'),
            ])
            ->groupBy('project_id', 'bucket')
            ->get();

        foreach ($rows as $row) {
            $bar = min(self::TREND_BARS - 1, intdiv((int) $row->bucket, intdiv(Period::BUCKETS, self::TREND_BARS)));

            $trends[$row->project_id] ??= array_fill(0, self::TREND_BARS, [0, 0]);
            $trends[$row->project_id][$bar][0] += (int) $row->total;
            $trends[$row->project_id][$bar][1] += (int) $row->errors;
        }

        return $trends;
    }

    /**
     * Register a new project and reveal its ingest token once.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'environment' => ['required', 'string', 'max:64'],
        ]);

        $project = Project::make($validated);
        $project->slug = Project::uniqueSlug($validated['name'], $validated['environment']);
        $token = $project->issueToken();

        return to_route('projects.setup', $project)->with('token', $token);
    }

    /**
     * The project dashboard.
     */
    public function show(Request $request, Project $project): Response
    {
        $period = Period::fromRequest($request->query('period'));
        $telemetry = new Telemetry($project, $period);
        $hosts = $project->hosts()->orderBy('hostname')->get();
        $latest = HostPresenter::latestVersions(Host::all());

        return Inertia::render('projects/show', [
            'period' => $period->toArray(),
            'requests' => $telemetry->requestTimeline(),
            'jobs' => $telemetry->jobTimeline(),
            'exceptions' => $telemetry->exceptionTimeline(),
            'resources' => $telemetry->cpuTimeline(),
            'routes' => $telemetry->routes(8),
            'topExceptions' => $telemetry->topExceptions(6),
            'hosts' => $hosts->map(fn (Host $host) => HostPresenter::present($host, $latest))->values(),
            'certificate' => $project->certificate(),
        ]);
    }

    /**
     * Installation instructions and token management.
     */
    public function setup(Request $request, Project $project): Response
    {
        return Inertia::render('projects/setup', [
            'ingestUrl' => url('/'),
            'token' => $request->session()->get('token'),
            'hasReported' => $project->last_seen_at !== null,
        ]);
    }

    /**
     * Rename a project or change its environment label.
     */
    public function update(Request $request, Project $project): RedirectResponse
    {
        $project->update($request->validate([
            'name' => ['required', 'string', 'max:255'],
            'environment' => ['required', 'string', 'max:64'],
        ]));

        return back();
    }

    /**
     * Replace the ingest token; agents using the old one stop being accepted.
     */
    public function regenerateToken(Project $project): RedirectResponse
    {
        $token = $project->issueToken();

        return to_route('projects.setup', $project)->with('token', $token);
    }

    /**
     * Delete a project and all of its telemetry.
     */
    public function destroy(Project $project): RedirectResponse
    {
        $project->delete();

        return to_route('projects.index');
    }
}
