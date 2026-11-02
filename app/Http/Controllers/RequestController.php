<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Queries\Telemetry;
use App\Support\Period;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RequestController extends Controller
{
    /**
     * Request volume and per-route performance.
     */
    public function index(Request $request, Project $project): Response
    {
        $period = Period::fromRequest($request->query('period'));
        $telemetry = new Telemetry($project, $period);

        return Inertia::render('requests/index', [
            'period' => $period->toArray(),
            'timeline' => $telemetry->requestTimeline(),
            'routes' => $telemetry->routes(50),
        ]);
    }
}
