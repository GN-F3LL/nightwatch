import { CertificateBadge } from '@/components/signal/certificate-badge';
import { HostCard } from '@/components/signal/host-card';
import { MetricPanel } from '@/components/signal/metric-panel';
import { PageHeader } from '@/components/signal/page-header';
import { EmptyRow, Panel } from '@/components/signal/panel';
import { PeriodPicker } from '@/components/signal/period-picker';
import { RoutesTable } from '@/components/signal/routes-table';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { formatCompact, formatInteger, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    type Certificate,
    type ExceptionSummary,
    type Host,
    type Period,
    type ResourceBucket,
    type RouteStat,
    type SharedData,
    type Timeline,
} from '@/types';
import { Head, Link, usePage, usePoll } from '@inertiajs/react';
import { useState } from 'react';

interface ProjectDashboardProps {
    period: Period;
    requests: Timeline;
    jobs: Timeline;
    exceptions: Timeline;
    resources: { buckets: ResourceBucket[] };
    routes: RouteStat[];
    topExceptions: ExceptionSummary[];
    hosts: Host[];
    certificate: Certificate | null;
}

export default function ProjectDashboard({
    period,
    requests,
    jobs,
    exceptions,
    resources,
    routes,
    topExceptions,
    hosts,
    certificate,
}: ProjectDashboardProps) {
    const project = usePage<SharedData>().props.currentProject!;
    const [live, setLive] = useState(true);
    const params = { project: project.slug };

    const { start, stop } = usePoll(15_000, {}, { autoStart: true });

    const toggleLive = () => {
        if (live) stop();
        else start();
        setLive(!live);
    };

    const cpuNow = [...resources.buckets].reverse().find((b) => b.cpu !== null);

    return (
        <AppLayout breadcrumbs={[{ title: project.name, href: route('projects.show', params) }]}>
            <Head title={project.name} />
            <div className="flex flex-col gap-5 p-4 md:p-6">
                <PageHeader title="Dashboard" description={`${project.name} · ${project.environment}`}>
                    <CertificateBadge certificate={certificate} className="h-8 px-2.5 text-xs" />
                    <Button variant="outline" size="sm" aria-pressed={live} onClick={toggleLive} className="h-8 gap-2 font-mono text-xs">
                        <span className={cn('size-1.5 rounded-full', live ? 'bg-signal-online animate-pulse' : 'bg-muted-foreground')} />
                        Live
                    </Button>
                    <PeriodPicker period={period} />
                </PageHeader>

                <div className="bg-border grid gap-px overflow-hidden rounded-lg border md:grid-cols-2 2xl:grid-cols-4">
                    <MetricPanel
                        title="Requests"
                        href={route('requests.index', { ...params, period: period.key })}
                        total={formatInteger(requests.total)}
                        buckets={requests.buckets}
                        series={[
                            { label: '2xx/3xx', value: formatCompact(requests.counts.ok), color: 'bg-signal-ok' },
                            { label: '4xx', value: formatCompact(requests.counts.client), color: 'bg-signal-warn' },
                            { label: '5xx', value: formatCompact(requests.counts.server), color: 'bg-signal-error' },
                        ]}
                    />
                    <MetricPanel
                        title="Jobs"
                        href={route('jobs.index', { ...params, period: period.key })}
                        total={formatInteger(jobs.total)}
                        buckets={jobs.buckets}
                        series={[
                            { label: 'processed', value: formatCompact(jobs.counts.processed), color: 'bg-signal-ok' },
                            { label: 'released', value: formatCompact(jobs.counts.released), color: 'bg-signal-warn' },
                            { label: 'failed', value: formatCompact(jobs.counts.failed), color: 'bg-signal-error' },
                        ]}
                    />
                    <MetricPanel
                        title="Exceptions"
                        href={route('exceptions.index', params)}
                        total={formatInteger(exceptions.total)}
                        totalClassName={exceptions.total > 0 ? 'text-signal-error' : undefined}
                        buckets={exceptions.buckets}
                        series={[
                            { label: 'handled', value: formatCompact(exceptions.counts.handled), color: 'bg-signal-error/45' },
                            { label: 'unhandled', value: formatCompact(exceptions.counts.unhandled), color: 'bg-signal-error' },
                        ]}
                    />
                    <MetricPanel
                        title={hosts.length === 1 ? `Server · ${hosts[0].hostname}` : `Servers · avg of ${hosts.length}`}
                        total={cpuNow?.cpu != null ? `${Math.round(cpuNow.cpu)}% CPU` : '—'}
                        totalClassName={(cpuNow?.cpu ?? 0) >= 80 ? 'text-signal-error' : undefined}
                        buckets={resources.buckets.map((b) => ({ at: b.at, values: [b.cpu ?? 0] }))}
                        max={100}
                        series={[
                            { label: 'CPU', value: cpuNow?.cpu != null ? `${Math.round(cpuNow.cpu)}%` : '—', color: 'bg-signal-accent' },
                            ...(cpuNow?.memory != null ? [{ label: 'RAM', value: `${Math.round(cpuNow.memory)}%`, color: 'bg-signal-track' }] : []),
                        ]}
                    />
                </div>

                <div className="flex flex-wrap gap-5">
                    <Panel
                        title="Routes by p95"
                        action={{ label: 'All routes', href: route('requests.index', { ...params, period: period.key }) }}
                        className="flex-[3_1_520px]"
                    >
                        {routes.length ? <RoutesTable routes={routes} /> : <EmptyRow>No requests recorded in this period.</EmptyRow>}
                    </Panel>

                    <Panel
                        title="Exceptions"
                        action={{ label: 'All exceptions', href: route('exceptions.index', params) }}
                        className="flex-[2_1_360px]"
                    >
                        {topExceptions.length ? (
                            topExceptions.map((e) => (
                                <Link
                                    key={e.id}
                                    href={route('exceptions.show', { ...params, exception: e.id })}
                                    className="hover:bg-accent/50 flex justify-between gap-3 border-t px-4 py-2.5 first:border-t-0"
                                >
                                    <span className="flex min-w-0 flex-col gap-0.5">
                                        <span className="truncate font-mono text-xs font-semibold">{e.class.split('\\').pop()}</span>
                                        <span className="text-muted-foreground truncate text-xs">{e.message}</span>
                                    </span>
                                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                                        <span className="text-signal-error font-mono text-xs font-semibold">{formatInteger(e.events)}</span>
                                        <span className="text-muted-foreground text-[11px]">{timeAgo(e.last_seen_at)}</span>
                                    </span>
                                </Link>
                            ))
                        ) : (
                            <EmptyRow>No exceptions in this period.</EmptyRow>
                        )}
                    </Panel>
                </div>

                <Panel title="Hosts" aside={<span className="text-muted-foreground text-xs">agents report every minute</span>}>
                    {hosts.length ? (
                        <div className="grid divide-y md:grid-cols-2 md:divide-x xl:grid-cols-3">
                            {hosts.map((host) => (
                                <HostCard key={host.id} host={host} />
                            ))}
                        </div>
                    ) : (
                        <EmptyRow>
                            No host has reported yet.{' '}
                            <Link href={route('projects.setup', params)} className="text-primary hover:underline">
                                Install the agent
                            </Link>
                        </EmptyRow>
                    )}
                </Panel>
            </div>
        </AppLayout>
    );
}
