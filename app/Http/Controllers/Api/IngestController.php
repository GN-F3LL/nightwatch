<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Ingest\Ingestor;
use App\Models\LogEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class IngestController extends Controller
{
    /**
     * Accept one batch of telemetry from an agent.
     */
    public function __invoke(Request $request, Ingestor $ingestor): JsonResponse
    {
        $max = config('signal.ingest.max_items');

        $request->validate([
            'host' => ['required', 'array'],
            'host.hostname' => ['required', 'string', 'max:255'],

            'certificate' => ['sometimes', 'nullable', 'array'],
            'certificate.host' => ['required_with:certificate', 'string', 'max:255'],
            'certificate.issuer' => ['nullable', 'string', 'max:255'],
            'certificate.expires_at' => ['required_with:certificate', 'date'],

            'metrics' => ['sometimes', 'array', "max:{$max}"],
            'metrics.*.recorded_at' => ['required', 'date'],

            'exceptions' => ['sometimes', 'array', "max:{$max}"],
            'exceptions.*.class' => ['required', 'string', 'max:255'],
            'exceptions.*.message' => ['present', 'nullable', 'string'],
            'exceptions.*.occurred_at' => ['required', 'date'],

            'logs' => ['sometimes', 'array', "max:{$max}"],
            'logs.*.level' => ['required', Rule::in(LogEntry::LEVELS)],
            'logs.*.message' => ['present', 'nullable', 'string'],
            'logs.*.logged_at' => ['required', 'date'],

            'requests' => ['sometimes', 'array', "max:{$max}"],
            'requests.*.method' => ['required', 'string', 'max:10'],
            'requests.*.route' => ['required', 'string', 'max:255'],
            'requests.*.status' => ['required', 'integer', 'between:100,599'],
            'requests.*.duration_ms' => ['required', 'integer', 'min:0'],
            'requests.*.recorded_at' => ['required', 'date'],

            'jobs' => ['sometimes', 'array', "max:{$max}"],
            'jobs.*.name' => ['required', 'string', 'max:255'],
            'jobs.*.status' => ['required', 'in:processed,released,failed'],
            'jobs.*.duration_ms' => ['required', 'integer', 'min:0'],
            'jobs.*.recorded_at' => ['required', 'date'],
        ]);

        // Free-form parts (traces, context) are sanitised by the ingestor rather than validated...
        $ingestor->ingest($request->attributes->get('project'), $request->all());

        return response()->json(['ok' => true], 202);
    }
}
