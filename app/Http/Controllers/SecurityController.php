<?php

namespace App\Http\Controllers;

use App\Security\SecurityReport;
use App\Security\VulnerabilityScanner;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class SecurityController extends Controller
{
    /**
     * Known vulnerabilities and support status of every version the fleet runs, optionally for one project.
     */
    public function index(Request $request): Response
    {
        $all = SecurityReport::components();
        $projects = SecurityReport::byProject($all);
        $project = $projects->has((string) $request->query('project')) ? $request->query('project') : null;
        $components = $project ? SecurityReport::components($project) : $all;

        return Inertia::render('security/index', [
            'components' => $components,
            'summary' => SecurityReport::summary($components),
            'projects' => $projects->values(),
            'project' => $project ? $projects[$project] : null,
            'nvdKey' => (bool) config('signal.vulnerabilities.nvd_api_key'),
        ]);
    }

    /**
     * Check every version again. Runs after the response is sent; the page polls until it finishes.
     */
    public function scan(): RedirectResponse
    {
        if (Cache::add(SecurityReport::RUNNING, true, 900)) {
            dispatch(function () {
                // The NVD's rate limit makes a full scan take a minute or more...
                set_time_limit(0);

                try {
                    app(VulnerabilityScanner::class)->scan(force: true);
                } finally {
                    Cache::forget(SecurityReport::RUNNING);
                }
            })->afterResponse();
        }

        return back();
    }
}
