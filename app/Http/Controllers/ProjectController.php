<?php

namespace App\Http\Controllers;

use App\Models\Host;
use App\Models\Project;
use App\Queries\Telemetry;
use App\Security\SecurityReport;
use App\Support\HostPresenter;
use App\Support\Period;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
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
                'hosts' => $project->hosts->map(fn (Host $host) => HostPresenter::present($host, $latest))->values(),
            ]),
        ]);
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
