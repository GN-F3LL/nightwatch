<?php

namespace App\Http\Controllers;

use App\Models\LogEntry;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class LogController extends Controller
{
    /**
     * Searchable log stream for a project.
     */
    public function index(Request $request, Project $project): Response
    {
        $level = in_array($request->query('level'), LogEntry::LEVELS, true) ? $request->query('level') : null;
        $search = trim((string) $request->query('search'));

        $entries = $project->logEntries()
            ->with('host:id,hostname')
            ->when($level, fn ($q) => $q->where('level', $level))
            ->when($search !== '', fn ($q) => $q->where('message', 'like', "%{$search}%"))
            ->orderByDesc('logged_at')
            ->orderByDesc('id')
            ->cursorPaginate(50)
            ->withQueryString();

        $levelCounts = $project->logEntries()
            ->where('logged_at', '>=', now()->subDay())
            ->select('level', DB::raw('COUNT(*) as total'))
            ->groupBy('level')
            ->pluck('total', 'level');

        return Inertia::render('logs/index', [
            'filters' => ['level' => $level, 'search' => $search],
            'levels' => collect(LogEntry::LEVELS)->map(fn ($l) => ['level' => $l, 'count' => (int) ($levelCounts[$l] ?? 0)]),
            'entries' => $entries->through(fn (LogEntry $e) => [
                'id' => $e->id,
                'level' => $e->level,
                'message' => $e->message,
                'context' => $e->context,
                'hostname' => $e->host?->hostname,
                'logged_at' => $e->logged_at->toIso8601String(),
            ]),
        ]);
    }
}
