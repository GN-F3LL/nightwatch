import { MetricPanel } from '@/components/signal/metric-panel';
import { PageHeader } from '@/components/signal/page-header';
import { EmptyRow, Panel } from '@/components/signal/panel';
import { PeriodPicker } from '@/components/signal/period-picker';
import { RoutesTable } from '@/components/signal/routes-table';
import AppLayout from '@/layouts/app-layout';
import { formatCompact, formatInteger } from '@/lib/format';
import { type Period, type RouteStat, type SharedData, type Timeline } from '@/types';
import { Head, usePage } from '@inertiajs/react';

export default function Requests({ period, timeline, routes }: { period: Period; timeline: Timeline; routes: RouteStat[] }) {
    const project = usePage<SharedData>().props.currentProject!;
    const params = { project: project.slug };

    return (
        <AppLayout
            breadcrumbs={[
                { title: project.name, href: route('projects.show', params) },
                { title: 'Requests', href: route('requests.index', params) },
            ]}
        >
            <Head title={`${project.name} · Requests`} />
            <div className="flex flex-col gap-5 p-4 md:p-6">
                <PageHeader title="Requests" description="HTTP traffic by status class and route performance.">
                    <PeriodPicker period={period} />
                </PageHeader>

                <div className="overflow-hidden rounded-lg border">
                    <MetricPanel
                        title="Requests"
                        total={formatInteger(timeline.total)}
                        buckets={timeline.buckets}
                        height={140}
                        series={[
                            { label: '2xx/3xx', value: formatCompact(timeline.counts.ok), color: 'bg-signal-ok' },
                            { label: '4xx', value: formatCompact(timeline.counts.client), color: 'bg-signal-warn' },
                            { label: '5xx', value: formatCompact(timeline.counts.server), color: 'bg-signal-error' },
                        ]}
                    />
                </div>

                <Panel title="Routes" aside={<span className="text-muted-foreground text-xs">slowest p95 first</span>}>
                    {routes.length ? <RoutesTable routes={routes} detailed /> : <EmptyRow>No requests recorded in this period.</EmptyRow>}
                </Panel>
            </div>
        </AppLayout>
    );
}
