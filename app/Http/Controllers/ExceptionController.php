<?php

namespace App\Http\Controllers;

use App\Models\ExceptionGroup;
use App\Models\ExceptionOccurrence;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ExceptionController extends Controller
{
    protected const TREND_DAYS = 14;

    /**
     * Exception groups for a project, filtered by status.
     */
    public function index(Request $request, Project $project): Response
    {
        $status = in_array($request->query('status'), ExceptionGroup::STATUSES, true) ? $request->query('status') : 'unresolved';
        $search = trim((string) $request->query('search'));

        $groups = $project->exceptionGroups()
            ->where('status', $status)
            ->when($search !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('class', 'like', "%{$search}%")
                ->orWhere('message', 'like', "%{$search}%")
                ->orWhere('file', 'like', "%{$search}%")))
            ->orderByDesc('last_seen_at')
            ->paginate(25)
            ->withQueryString();

        $trends = $this->dailyTrends($groups->pluck('id')->all());

        $statusCounts = $project->exceptionGroups()
            ->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        return Inertia::render('exceptions/index', [
            'filters' => ['status' => $status, 'search' => $search],
            'counts' => collect(ExceptionGroup::STATUSES)->mapWithKeys(fn ($s) => [$s => (int) ($statusCounts[$s] ?? 0)]),
            'groups' => $groups->through(fn (ExceptionGroup $g) => $this->presentGroup($g) + [
                'trend' => $trends[$g->id] ?? array_fill(0, self::TREND_DAYS, 0),
            ]),
        ]);
    }

    /**
     * One exception group with its latest occurrence.
     */
    public function show(Request $request, Project $project, ExceptionGroup $exception): Response
    {
        abort_unless((int) $exception->project_id === (int) $project->id, 404);

        $occurrence = $request->integer('occurrence')
            ? $exception->occurrences()->with('host')->findOrFail($request->integer('occurrence'))
            : $exception->occurrences()->with('host')->latest('occurred_at')->first();

        $recent = $exception->occurrences()
            ->with('host:id,hostname')
            ->latest('occurred_at')
            ->limit(20)
            ->get(['id', 'host_id', 'handled', 'occurred_at', 'context']);

        return Inertia::render('exceptions/show', [
            'group' => $this->presentGroup($exception) + [
                'trend' => $this->dailyTrends([$exception->id])[$exception->id] ?? array_fill(0, self::TREND_DAYS, 0),
                'hosts' => $exception->occurrences()->distinct()->count('host_id'),
            ],
            'occurrence' => $occurrence ? [
                'id' => $occurrence->id,
                'message' => $occurrence->message,
                'handled' => $occurrence->handled,
                'trace' => $occurrence->trace ?? [],
                'code' => $occurrence->code,
                'context' => $occurrence->context ?? [],
                'php_version' => $occurrence->php_version,
                'laravel_version' => $occurrence->laravel_version,
                'hostname' => $occurrence->host?->hostname,
                'occurred_at' => $occurrence->occurred_at->toIso8601String(),
            ] : null,
            'recent' => $recent->map(fn (ExceptionOccurrence $o) => [
                'id' => $o->id,
                'hostname' => $o->host?->hostname,
                'handled' => $o->handled,
                'url' => $o->context['request']['url'] ?? null,
                'job' => $o->context['job']['name'] ?? null,
                'occurred_at' => $o->occurred_at->toIso8601String(),
            ]),
        ]);
    }

    /**
     * Resolve, ignore or reopen a group.
     */
    public function update(Request $request, Project $project, ExceptionGroup $exception): RedirectResponse
    {
        abort_unless((int) $exception->project_id === (int) $project->id, 404);

        $status = $request->validate(['status' => ['required', Rule::in(ExceptionGroup::STATUSES)]])['status'];

        $exception->forceFill([
            'status' => $status,
            'resolved_at' => $status === 'resolved' ? now() : null,
            'regressed_at' => $status === 'unresolved' ? $exception->regressed_at : null,
        ])->save();

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    protected function presentGroup(ExceptionGroup $group): array
    {
        return [
            'id' => $group->id,
            'class' => $group->class,
            'message' => $group->message,
            'file' => $group->file,
            'line' => $group->line,
            'status' => $group->status,
            'occurrences' => $group->occurrence_count,
            'first_seen_at' => $group->first_seen_at->toIso8601String(),
            'last_seen_at' => $group->last_seen_at->toIso8601String(),
            'resolved_at' => $group->resolved_at?->toIso8601String(),
            'regressed_at' => $group->regressed_at?->toIso8601String(),
        ];
    }

    /**
     * Occurrences per day over the last TREND_DAYS days, keyed by group id.
     *
     * @param  list<int>  $groupIds
     * @return array<int, list<int>>
     */
    protected function dailyTrends(array $groupIds): array
    {
        if ($groupIds === []) {
            return [];
        }

        $start = now()->startOfDay()->subDays(self::TREND_DAYS - 1);

        $rows = ExceptionOccurrence::query()
            ->whereIn('exception_group_id', $groupIds)
            ->where('occurred_at', '>=', $start)
            ->select('exception_group_id', DB::raw('DATE(occurred_at) as day'), DB::raw('COUNT(*) as total'))
            ->groupBy('exception_group_id', 'day')
            ->get();

        $trends = [];

        foreach ($rows as $row) {
            $index = (int) $start->diffInDays($row->day);

            if ($index >= 0 && $index < self::TREND_DAYS) {
                $trends[$row->exception_group_id] ??= array_fill(0, self::TREND_DAYS, 0);
                $trends[$row->exception_group_id][$index] = (int) $row->total;
            }
        }

        return $trends;
    }
}
