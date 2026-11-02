import { Panel } from '@/components/signal/panel';
import { StackedBars } from '@/components/signal/stacked-bars';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { formatDate, formatDateTime, formatInteger, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type CodeSnippet, type ExceptionGroup, type ExceptionStatus, type SharedData, type StackFrame } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

interface Occurrence {
    id: number;
    message: string;
    handled: boolean;
    trace: StackFrame[];
    code: CodeSnippet | null;
    context: Record<string, unknown>;
    php_version: string | null;
    laravel_version: string | null;
    hostname: string | null;
    occurred_at: string;
}

interface RecentOccurrence {
    id: number;
    hostname: string | null;
    handled: boolean;
    url: string | null;
    job: string | null;
    occurred_at: string;
}

interface ExceptionShowProps {
    group: ExceptionGroup & { hosts: number };
    occurrence: Occurrence | null;
    recent: RecentOccurrence[];
}

const DAY = 86_400_000;

export default function ExceptionShow({ group, occurrence, recent }: ExceptionShowProps) {
    const project = usePage<SharedData>().props.currentProject!;
    const params = { project: project.slug };

    const setStatus = (status: ExceptionStatus) => {
        router.patch(route('exceptions.update', { ...params, exception: group.id }), { status }, { preserveScroll: true });
    };

    const trendStart = Date.now() - (group.trend.length - 1) * DAY;
    const trendBuckets = group.trend.map((value, i) => ({ at: new Date(trendStart + i * DAY).toISOString(), values: [value] }));
    const regressed = group.regressed_at !== null && group.status === 'unresolved';

    return (
        <AppLayout
            breadcrumbs={[
                { title: project.name, href: route('projects.show', params) },
                { title: 'Exceptions', href: route('exceptions.index', params) },
                { title: group.class.split('\\').pop() ?? group.class, href: route('exceptions.show', { ...params, exception: group.id }) },
            ]}
        >
            <Head title={group.class} />
            <div className="flex flex-col gap-5 p-4 md:p-6">
                <header className="flex flex-wrap justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-2">
                        <StatusTag status={group.status} regressed={regressed} regressedAt={group.regressed_at} />
                        <h1 className="font-mono text-lg font-semibold break-words">{group.class}</h1>
                        <p className="text-foreground/80 max-w-3xl text-[15px] break-words">{occurrence?.message ?? group.message}</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            <Chip k="project" v={project.name} />
                            <Chip k="env" v={project.environment} />
                            {occurrence?.hostname && <Chip k="host" v={occurrence.hostname} />}
                            {occurrence?.php_version && <Chip k="php" v={occurrence.php_version} />}
                            {occurrence?.laravel_version && <Chip k="laravel" v={occurrence.laravel_version} />}
                            {occurrence && <Chip k="handled" v={occurrence.handled ? 'yes' : 'no'} />}
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        {group.status !== 'resolved' && <Button onClick={() => setStatus('resolved')}>Resolve</Button>}
                        {group.status !== 'ignored' && (
                            <Button variant="outline" onClick={() => setStatus('ignored')}>
                                Ignore
                            </Button>
                        )}
                        {group.status !== 'unresolved' && (
                            <Button variant="outline" onClick={() => setStatus('unresolved')}>
                                Reopen
                            </Button>
                        )}
                    </div>
                </header>

                <dl className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border md:grid-cols-4">
                    <Fact k="Events" v={formatInteger(group.occurrences)} />
                    <Fact k="First seen" v={formatDate(group.first_seen_at)} />
                    <Fact k="Last seen" v={timeAgo(group.last_seen_at)} />
                    <Fact k="Hosts" v={formatInteger(group.hosts)} />
                </dl>

                <div className="flex flex-col gap-2">
                    <span className="text-muted-foreground text-xs">Events · 14 days</span>
                    <StackedBars buckets={trendBuckets} colors={['bg-signal-error']} labels={['events']} height={56} />
                </div>

                {occurrence && (
                    <>
                        <StackTrace trace={occurrence.trace} code={occurrence.code} />
                        <ContextPanels context={occurrence.context} />
                    </>
                )}

                <Panel title="Recent occurrences">
                    <ul className="font-mono text-xs">
                        {recent.map((o) => (
                            <li key={o.id} className="border-t first:border-t-0">
                                <Link
                                    href={route('exceptions.show', { ...params, exception: group.id, occurrence: o.id })}
                                    preserveScroll
                                    className={cn(
                                        'hover:bg-accent/40 grid grid-cols-[150px_minmax(0,1fr)_auto] gap-3 px-4 py-2',
                                        o.id === occurrence?.id && 'bg-accent/60',
                                    )}
                                >
                                    <span className="text-muted-foreground">{formatDateTime(o.occurred_at)}</span>
                                    <span className="truncate">{o.url ?? o.job ?? '—'}</span>
                                    <span className="text-muted-foreground">{o.hostname}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>
        </AppLayout>
    );
}

function StatusTag({ status, regressed, regressedAt }: { status: ExceptionStatus; regressed: boolean; regressedAt: string | null }) {
    const label = regressed ? `Regressed · ${timeAgo(regressedAt)}` : status;
    const tone =
        regressed || status === 'unresolved'
            ? 'bg-signal-error/15 text-signal-error'
            : status === 'resolved'
              ? 'bg-primary/15 text-primary'
              : 'bg-muted text-muted-foreground';

    return <span className={cn('self-start rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase', tone)}>{label}</span>;
}

function Chip({ k, v }: { k: string; v: string }) {
    return (
        <span className="bg-muted rounded border px-2 py-0.5 font-mono text-[11px]">
            <span className="text-muted-foreground">{k}</span> {v}
        </span>
    );
}

function Fact({ k, v }: { k: string; v: string }) {
    return (
        <div className="bg-card flex flex-col gap-1 px-4 py-3">
            <dt className="text-muted-foreground text-xs">{k}</dt>
            <dd className="font-mono text-lg font-semibold">{v}</dd>
        </div>
    );
}

function StackTrace({ trace, code }: { trace: StackFrame[]; code: CodeSnippet | null }) {
    const [showVendor, setShowVendor] = useState(false);
    const vendorCount = trace.filter((f) => !f.app).length;
    const frames = showVendor ? trace : trace.filter((f) => f.app);

    return (
        <Panel
            title="Stack trace"
            aside={
                vendorCount > 0 && (
                    <button type="button" onClick={() => setShowVendor(!showVendor)} className="text-primary text-xs hover:underline">
                        {showVendor ? 'App frames only' : `Show all ${trace.length} frames`}
                    </button>
                )
            }
        >
            {code && (
                <div className="flex flex-col gap-2 p-4 pb-2">
                    <span className="font-mono text-xs">
                        <span className="text-primary">{code.file}</span>:{code.line}
                    </span>
                    <div className="bg-background/60 overflow-x-auto rounded-md border">
                        <pre className="min-w-max py-2 font-mono text-xs leading-relaxed">
                            {code.lines.map((text, i) => {
                                const number = code.start + i;
                                const active = number === code.line;

                                return (
                                    <div
                                        key={number}
                                        className={cn(
                                            'grid grid-cols-[48px_1fr]',
                                            active && 'bg-signal-error/15 shadow-signal-error shadow-[inset_3px_0_0]',
                                        )}
                                    >
                                        <span className={cn('pr-4 text-right select-none', active ? 'text-signal-error' : 'text-muted-foreground')}>
                                            {number}
                                        </span>
                                        <span className={active ? 'text-foreground' : 'text-foreground/75'}>{text || ' '}</span>
                                    </div>
                                );
                            })}
                        </pre>
                    </div>
                </div>
            )}
            <ol className="font-mono text-xs">
                {frames.map((frame, i) => (
                    <li key={i} className="flex justify-between gap-4 border-t px-4 py-2.5">
                        <span className={cn('min-w-0 truncate', frame.app ? 'text-foreground' : 'text-muted-foreground')}>
                            {frame.file ?? '[internal]'}
                            {frame.line ? `:${frame.line}` : ''}
                        </span>
                        <span className="text-muted-foreground shrink-0 truncate">
                            {frame.class ? `${frame.class.split('\\').pop()}::` : ''}
                            {frame.function}
                        </span>
                    </li>
                ))}
                {frames.length === 0 && (
                    <li className="text-muted-foreground border-t px-4 py-3">No application frames. Show all frames to see the vendor trace.</li>
                )}
            </ol>
        </Panel>
    );
}

function ContextPanels({ context }: { context: Record<string, unknown> }) {
    const sections = Object.entries(context).filter(([, value]) => value && typeof value === 'object' && Object.keys(value as object).length > 0);

    if (sections.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sections.map(([title, value]) => (
                <section key={title} className="bg-card flex flex-col gap-2 rounded-lg border p-4">
                    <h3 className="text-[13px] font-semibold capitalize">{title}</h3>
                    {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 text-xs">
                            <span className="text-muted-foreground shrink-0">{k}</span>
                            <span className="min-w-0 truncate text-right font-mono" title={typeof v === 'string' ? v : JSON.stringify(v)}>
                                {typeof v === 'string' ? v : JSON.stringify(v)}
                            </span>
                        </div>
                    ))}
                </section>
            ))}
        </div>
    );
}
