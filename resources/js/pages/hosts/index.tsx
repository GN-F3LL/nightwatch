import { PageHeader } from '@/components/signal/page-header';
import { EmptyRow, Panel } from '@/components/signal/panel';
import { Sparkline } from '@/components/signal/sparkline';
import { StatusDot } from '@/components/signal/status-dot';
import { VersionText } from '@/components/signal/version-badge';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { formatBytes, formatPercent, timeAgo, usageFill, usageTone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Host, type Version } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { useMemo, useState } from 'react';

interface FleetHost extends Host {
    project: { name: string; slug: string; environment: string };
    cpu_trend: number[];
}

interface FleetProps {
    hosts: FleetHost[];
    latest: { php: string | null; laravel: string | null; composer: string | null; node: string | null };
}

type Filter = 'all' | 'outdated' | 'eol' | 'busy' | 'offline';

const isOutdated = (v: Version | null) => v !== null && v.state !== 'current';

const filters: { key: Filter; label: string; test: (h: FleetHost) => boolean }[] = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'outdated', label: 'Outdated', test: (h) => Object.values(h.versions).some(isOutdated) },
    { key: 'eol', label: 'End of life', test: (h) => Object.values(h.versions).some((v) => v?.state === 'eol') },
    { key: 'busy', label: 'High usage', test: (h) => [h.cpu_percent, h.memory_percent, h.disk_percent].some((v) => (v ?? 0) >= 80) },
    { key: 'offline', label: 'Offline', test: (h) => !h.online },
];

export default function Hosts({ hosts, latest }: FleetProps) {
    const [filter, setFilter] = useState<Filter>('all');
    const visible = useMemo(() => hosts.filter(filters.find((f) => f.key === filter)!.test), [hosts, filter]);

    return (
        <AppLayout breadcrumbs={[{ title: 'Hosts & versions', href: route('hosts.index') }]}>
            <Head title="Hosts & versions" />
            <div className="flex flex-col gap-5 p-4 md:p-6">
                <PageHeader
                    title="Hosts & versions"
                    description={`${hosts.length} hosts · newest seen: PHP ${latest.php ?? '—'} · Laravel ${latest.laravel ?? '—'} · Composer ${latest.composer ?? '—'} · Node ${latest.node ?? '—'}`}
                />

                <div className="bg-border grid gap-px overflow-hidden rounded-lg border md:grid-cols-3">
                    <Distribution title="PHP" values={hosts.map((h) => h.versions.php)} digits={2} />
                    <Distribution title="Laravel" values={hosts.map((h) => h.versions.laravel)} digits={1} />
                    <Distribution title="OS" values={hosts.map((h) => (h.os ? { value: h.os, state: 'current' as const } : null))} digits={0} />
                </div>

                <div role="group" aria-label="Filter hosts" className="flex flex-wrap gap-2">
                    {filters.map((f) => (
                        <Button
                            key={f.key}
                            size="sm"
                            variant={filter === f.key ? 'secondary' : 'outline'}
                            aria-pressed={filter === f.key}
                            onClick={() => setFilter(f.key)}
                            className="gap-2"
                        >
                            {f.label}
                            <span className="text-muted-foreground font-mono text-xs">{hosts.filter(f.test).length}</span>
                        </Button>
                    ))}
                </div>

                <Panel title="Fleet">
                    {visible.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1440px] text-[13px]">
                                <thead>
                                    <tr className="text-muted-foreground text-left text-[11px] tracking-wide uppercase">
                                        <th className="px-4 py-2.5 font-medium">Host</th>
                                        <th className="px-3 py-2.5 font-medium">OS</th>
                                        <th className="px-3 py-2.5 font-medium">PHP</th>
                                        <th className="px-3 py-2.5 font-medium">Laravel</th>
                                        <th className="px-3 py-2.5 font-medium">Composer</th>
                                        <th className="px-3 py-2.5 font-medium">Node</th>
                                        <th className="px-3 py-2.5 font-medium">Database</th>
                                        <th className="px-3 py-2.5 font-medium">Web server</th>
                                        <th className="px-3 py-2.5 font-medium">CPU</th>
                                        <th className="px-3 py-2.5 font-medium">RAM</th>
                                        <th className="px-3 py-2.5 font-medium">Disk</th>
                                        <th className="px-3 py-2.5 font-medium">CPU 24h</th>
                                        <th className="px-4 py-2.5 text-right font-medium">Seen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((host) => (
                                        <tr key={host.id} className={cn('border-t', !host.online && 'opacity-60')}>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2.5">
                                                    <StatusDot online={host.online} />
                                                    <div className="flex min-w-0 flex-col">
                                                        <Link
                                                            href={route('projects.show', { project: host.project.slug })}
                                                            className="font-semibold hover:underline"
                                                        >
                                                            {host.project.name}
                                                        </Link>
                                                        <span className="text-muted-foreground font-mono text-[11px]">
                                                            {host.hostname} · {host.project.environment}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap" title={host.kernel ?? undefined}>
                                                {host.os ?? '—'}
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <VersionText version={host.versions.php} />
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <VersionText version={host.versions.laravel} />
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <VersionText version={host.versions.composer} />
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <VersionText version={host.versions.node} />
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <VersionText version={host.versions.database} />
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <VersionText version={host.versions.web_server} />
                                            </td>
                                            <UsageCell value={host.cpu_percent} detail={host.cpu_cores ? `${host.cpu_cores} cores` : undefined} />
                                            <UsageCell
                                                value={host.memory_percent}
                                                detail={`${formatBytes(host.memory_used)} / ${formatBytes(host.memory_total)}`}
                                            />
                                            <UsageCell
                                                value={host.disk_percent}
                                                detail={`${formatBytes(host.disk_used)} / ${formatBytes(host.disk_total)}`}
                                            />
                                            <td className="text-signal-accent px-3 py-2.5">
                                                <Sparkline values={host.cpu_trend} label="Hourly CPU average, last 24 hours" />
                                            </td>
                                            <td
                                                className={cn(
                                                    'px-4 py-2.5 text-right font-mono text-xs whitespace-nowrap',
                                                    host.online ? 'text-muted-foreground' : 'text-signal-error',
                                                )}
                                            >
                                                {timeAgo(host.last_seen_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyRow>{hosts.length ? 'No hosts match this filter.' : 'No host has reported yet.'}</EmptyRow>
                    )}
                </Panel>
            </div>
        </AppLayout>
    );
}

function UsageCell({ value, detail }: { value: number | null; detail?: string }) {
    return (
        <td className="px-3 py-2.5" title={detail}>
            <div className="flex items-center gap-2 font-mono text-xs">
                <span className={cn('w-9 text-right', usageTone(value))}>{formatPercent(value)}</span>
                <div className="bg-signal-track h-1 w-12 overflow-hidden rounded-full">
                    <div className={cn('h-full', usageFill(value))} style={{ width: `${Math.min(100, value ?? 0)}%` }} />
                </div>
            </div>
        </td>
    );
}

/**
 * Share of hosts per version line (e.g. PHP 8.3, Laravel 12).
 */
function Distribution({ title, values, digits }: { title: string; values: (Version | null)[]; digits: number }) {
    const groups = new Map<string, { count: number; state: Version['state'] }>();
    const severity = { current: 0, behind: 1, eol: 2 };

    for (const v of values) {
        if (!v) continue;
        const key = digits ? v.value.replace(/^v/, '').split('.').slice(0, digits).join('.') : v.value;
        const existing = groups.get(key);
        const worst = existing && severity[existing.state] > severity[v.state] ? existing.state : v.state;
        groups.set(key, { count: (existing?.count ?? 0) + 1, state: worst });
    }

    const entries = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }));
    const total = entries.reduce((n, [, g]) => n + g.count, 0);
    const tone = { current: 'bg-signal-accent', behind: 'bg-signal-warn', eol: 'bg-signal-error' };
    const text = { current: 'text-foreground', behind: 'text-signal-warn', eol: 'text-signal-error' };

    return (
        <section className="bg-card flex flex-col gap-3 p-4">
            <h2 className="text-foreground/80 text-[13px] font-semibold">{title}</h2>
            {total === 0 ? (
                <p className="text-muted-foreground text-xs">No data yet.</p>
            ) : (
                <>
                    <div
                        className="flex h-2.5 gap-0.5 overflow-hidden rounded-sm"
                        role="img"
                        aria-label={entries.map(([k, g]) => `${k}: ${g.count}`).join(', ')}
                    >
                        {entries.map(([key, g]) => (
                            <div
                                key={key}
                                className={tone[g.state]}
                                style={{ flexGrow: g.count, flexBasis: 0, opacity: g.state === 'current' ? 0.85 : 1 }}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
                        {entries.map(([key, g]) => (
                            <span key={key} className={cn('inline-flex items-center gap-1.5', text[g.state])}>
                                <span className={cn('size-2 rounded-[2px]', tone[g.state])} />
                                {key} · {g.count}
                            </span>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
