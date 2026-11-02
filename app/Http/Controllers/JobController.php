<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Queries\Telemetry;
use App\Support\Period;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class JobController extends Controller
{
    /**
     * Queue throughput and per-job outcomes.
     */
    public function index(Request $request, Project $project): Response
    {
        $period = Period::fromRequest($request->query('period'));
        $telemetry = new Telemetry($project, $period);

        return Inertia::render('jobs/index', [
            'period' => $period->toArray(),
            'timeline' => $telemetry->jobTimeline(),
            'jobs' => $telemetry->jobs(),
        ]);
    }
}
