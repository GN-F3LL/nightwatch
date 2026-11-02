<?php

namespace App\Security;

use App\Models\Host;
use App\Models\VersionCheck;
use App\Support\HostPresenter;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * What the fleet runs, joined with the latest vulnerability check of each version.
 */
class SecurityReport
{
    /**
     * Cache key held while a scan runs.
     */
    public const RUNNING = 'signal:vulnerability-scan';

    protected const STATUS_RANK = ['vulnerable' => 4, 'eol' => 3, 'outdated' => 2, 'pending' => 1, 'ok' => 0];

    /**
     * One entry per installed component version, the most urgent first, optionally limited to one project's hosts.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public static function components(?string $project = null): Collection
    {
        $checks = VersionCheck::all()->keyBy(fn (VersionCheck $c) => "{$c->component}|{$c->version}");
        $groups = [];

        $hosts = Host::with('project:id,name,slug')
            ->when($project, fn ($q) => $q->whereRelation('project', 'slug', $project))
            ->orderBy('hostname')
            ->get();

        foreach ($hosts as $host) {
            foreach (HostPresenter::stack($host) as $component => $version) {
                if (isset(VulnerabilityScanner::COMPONENTS[$component])) {
                    $groups["{$component}|{$version}"][] = ['hostname' => $host->hostname, 'project' => $host->project->only('name', 'slug')];
                }
            }
        }

        return collect($groups)
            ->map(fn (array $hosts, string $key) => self::entry($key, $hosts, $checks[$key] ?? null))
            ->sort(fn ($a, $b) => [self::STATUS_RANK[$b['status']], VulnerabilityScanner::SEVERITY_RANK[$b['worst'] ?? 'unknown'], count($b['advisories'])]
                <=> [self::STATUS_RANK[$a['status']], VulnerabilityScanner::SEVERITY_RANK[$a['worst'] ?? 'unknown'], count($a['advisories'])])
            ->values();
    }

    /**
     * What each project has to fix, keyed by project slug, the most urgent first.
     *
     * @param  Collection<int, array<string, mixed>>  $components  all components, unfiltered
     * @return Collection<string, array<string, mixed>>
     */
    public static function byProject(Collection $components): Collection
    {
        $projects = [];

        foreach ($components as $component) {
            foreach (collect($component['hosts'])->pluck('project')->unique('slug') as $project) {
                $projects[$project['slug']]['project'] = $project;
                $projects[$project['slug']]['components'][] = $component;
            }
        }

        return collect($projects)
            ->map(function (array $entry) {
                $components = collect($entry['components']);
                $summary = self::summary($components);

                return [
                    'name' => $entry['project']['name'],
                    'slug' => $entry['project']['slug'],
                    'to_update' => $components->whereIn('status', ['vulnerable', 'eol'])->count(),
                    'outdated' => $summary['outdated'],
                    'eol' => $summary['eol'],
                    'critical' => $summary['critical'],
                    'high' => $summary['high'],
                    'medium' => $summary['medium'],
                    'low' => $summary['low'] + $summary['unknown'],
                    'components' => $components->count(),
                ];
            })
            ->sortByDesc(fn ($p) => [$p['critical'], $p['high'], $p['to_update'], $p['medium']])
            ->values()
            ->keyBy('slug');
    }

    /**
     * Counts for the header button and the summary tiles.
     *
     * @param  Collection<int, array<string, mixed>>  $components
     * @return array<string, mixed>
     */
    public static function summary(Collection $components): array
    {
        $advisories = $components->flatMap(fn ($c) => $c['advisories'])->unique('id');
        $severities = array_fill_keys(array_keys(VulnerabilityScanner::SEVERITY_RANK), 0);

        foreach ($advisories as $advisory) {
            $severities[$advisory['severity']]++;
        }

        return $severities + [
            'vulnerable' => $components->where('status', 'vulnerable')->count(),
            'eol' => $components->where('eol', true)->count(),
            'outdated' => $components->where('status', 'outdated')->count(),
            'pending' => $components->where('status', 'pending')->count(),
            'total' => $components->count(),
            'checked_at' => VersionCheck::whereNotNull('checked_at')->latest('checked_at')->first()?->checked_at->toIso8601String(),
            'running' => Cache::has(self::RUNNING),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $hosts
     * @return array<string, mixed>
     */
    protected static function entry(string $key, array $hosts, ?VersionCheck $check): array
    {
        [$component, $version] = explode('|', $key, 2);
        $advisories = $check?->advisories ?? [];

        $status = match (true) {
            $check?->checked_at === null => 'pending',
            $advisories !== [] => 'vulnerable',
            $check->eol === true => 'eol',
            $check->latest_patch !== null && version_compare($version, $check->latest_patch, '<') => 'outdated',
            default => 'ok',
        };

        return [
            'key' => $key,
            'component' => $component,
            'name' => VulnerabilityScanner::COMPONENTS[$component]['name'],
            'version' => $version,
            'status' => $status,
            'worst' => $advisories[0]['severity'] ?? null,
            'advisories' => $advisories,
            'latest_patch' => $check?->latest_patch,
            'latest_release' => $check?->latest_release,
            'eol' => $check?->eol,
            'eol_date' => $check?->eol_date?->toDateString(),
            'recommendation' => $check ? self::recommendation($version, $check, $advisories) : null,
            'error' => $check?->error,
            'checked_at' => $check?->checked_at?->toIso8601String(),
            'hosts' => $hosts,
        ];
    }

    /**
     * The version to move to: the newest patch of the line when it covers every known fix, else the highest fix.
     *
     * @param  list<array<string, mixed>>  $advisories
     */
    protected static function recommendation(string $version, VersionCheck $check, array $advisories): ?string
    {
        if ($check->eol) {
            return $check->latest_release
                ? "This release line no longer gets security fixes. Upgrade to {$check->latest_release}."
                : 'This release line no longer gets security fixes. Upgrade to a supported release.';
        }

        $target = collect($advisories)
            ->pluck('fixed_in')
            ->push($check->latest_patch)
            ->filter(fn ($v) => $v && version_compare($version, $v, '<'))
            ->sort(fn ($a, $b) => version_compare($a, $b))
            ->last();

        return match (true) {
            $advisories !== [] && $target !== null => "Update to {$target} or later.",
            $advisories !== [] => 'No fixed release is listed yet. Check the advisories for mitigations.',
            $target !== null => "Patch release {$target} is available.",
            default => null,
        };
    }
}
