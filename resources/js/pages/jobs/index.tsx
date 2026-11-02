import { MetricPanel } from '@/components/signal/metric-panel';
import { PageHeader } from '@/components/signal/page-header';
import { EmptyRow, Panel } from '@/components/signal/panel';
import { PeriodPicker } from '@/components/signal/period-picker';
import AppLayout from '@/layouts/app-layout';
import { formatCompact, formatDuration, formatInteger } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type JobStat, type Period, type SharedData, type Timeline } from '@/types';
import { Head, usePage } from '@inertiajs/react';

export default function Jobs({ period, timeline, jobs }: { period: Period; timeline: Timeline; jobs: JobStat[] }) {
    const project = usePage<SharedData>().props.currentProject!;
    const params = { project: project.slug };

    return (
        <AppLayout
            breadcrumbs={[
                { title: project.name, href: route('projects.show', params) },
                { title: 'Jobs', href: route('jobs.index', params) },
            ]}
        >
            <Head title={`${project.name} · Jobs`} />
            <div className="flex flex-col gap-5 p-4 md:p-6">
                <PageHeader title="Jobs" description="Queued job outcomes and durations.">
                    <PeriodPicker period={period} />
                </PageHeader>

                <div className="overflow-hidden rounded-lg border">
                    <MetricPanel
                        title="Jobs"
                        total={formatInteger(timeline.total)}
                        buckets={timeline.buckets}
                        height={140}
                        series={[
                            { label: 'processed', value: formatCompact(timeline.counts.processed), color: 'bg-signal-ok' },
                            { label: 'released', value: formatCompact(timeline.counts.released), color: 'bg-signal-warn' },
                            { label: 'failed', value: formatCompact(timeline.counts.failed), color: 'bg-signal-error' },
                        ]}
                    />
                </div>

                <Panel title="Job classes" aside={<span className="text-muted-foreground text-xs">most failures first</span>}>
                    {jobs.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-[13px]">
                                <thead>
                                    <tr className="text-muted-foreground text-left text-[11px] tracking-wide uppercase">
                                        <th className="px-4 py-2.5 font-medium">Job</th>
                                        <th className="px-3 py-2.5 text-right font-medium">Processed</th>
                                        <th className="px-3 py-2.5 text-right font-medium">Released</th>
                                        <th className="px-3 py-2.5 text-right font-medium">Failed</th>
                                        <th className="px-3 py-2.5 text-right font-medium">Avg</th>
                                        <th className="px-4 py-2.5 text-right font-medium">Max</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono text-xs">
                                    {jobs.map((job) => (
                                        <tr key={job.name} className="border-t">
                                            <td className="px-4 py-2.5">
                                                <span className="block">{job.name}</span>
                                                {job.queue && <span className="text-muted-foreground text-[11px]">queue: {job.queue}</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-right">{formatInteger(job.processed)}</td>
                                            <td
                                                className={cn(
                                                    'px-3 py-2.5 text-right',
                                                    job.released > 0 ? 'text-signal-warn' : 'text-muted-foreground',
                                                )}
                                            >
                                                {formatInteger(job.released)}
                                            </td>
                                            <td
                                                className={cn(
                                                    'px-3 py-2.5 text-right font-semibold',
                                                    job.failed > 0 ? 'text-signal-error' : 'text-muted-foreground',
                                                )}
                                            >
                                                {formatInteger(job.failed)}
                                            </td>
                                            <td className="px-3 py-2.5 text-right">{formatDuration(job.avg_ms)}</td>
                                            <td className="text-muted-foreground px-4 py-2.5 text-right">{formatDuration(job.max_ms)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyRow>No jobs recorded in this period.</EmptyRow>
                    )}
                </Panel>
            </div>
        </AppLayout>
    );
}
