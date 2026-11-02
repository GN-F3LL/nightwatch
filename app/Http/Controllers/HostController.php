<?php

namespace App\Http\Controllers;

use App\Models\Host;
use App\Models\HostMetric;
use App\Support\HostPresenter;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class HostController extends Controller
{
    /**
     * Every host across all projects, with versions and resources.
     */
    public function index(): Response
    {
        $hosts = Host::with('project:id,name,slug,environment')->orderBy('hostname')->get();
        $latest = HostPresenter::latestVersions($hosts);

        // Hourly CPU average over the last day for the sparkline column...
        $since = now()->subDay();
        $hourExpression = match (DB::connection()->getDriverName()) {
            'sqlite' => "strftime('%Y-%m-%d %H', recorded_at)",
            'pgsql' => "to_char(recorded_at, 'YYYY-MM-DD HH24')",
            default => "DATE_FORMAT(recorded_at, '%Y-%m-%d %H')",
        };

        $cpu = HostMetric::query()
            ->where('recorded_at', '>=', $since)
            ->select('host_id', DB::raw("{$hourExpression} as hour"), DB::raw('AVG(cpu_percent) as cpu'))
            ->groupBy('host_id', 'hour')
            ->orderBy('hour')
            ->get()
            ->groupBy('host_id')
            ->map(fn ($rows) => $rows->map(fn ($r) => round((float) $r->cpu, 1))->values());

        return Inertia::render('hosts/index', [
            'latest' => $latest,
            'hosts' => $hosts->map(fn (Host $host) => HostPresenter::present($host, $latest) + [
                'project' => $host->project->only('name', 'slug', 'environment'),
                'cpu_trend' => $cpu[$host->id] ?? [],
            ]),
        ]);
    }
}
