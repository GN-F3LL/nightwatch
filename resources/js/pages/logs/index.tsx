import { PageHeader } from '@/components/signal/page-header';
import { EmptyRow, Panel } from '@/components/signal/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { formatDateTime, formatInteger } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Paginated, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';

interface LogEntry {
    id: number;
    level: string;
    message: string;
    context: Record<string, unknown> | null;
    hostname: string | null;
    logged_at: string;
}

interface LogsProps {
    filters: { level: string | null; search: string };
    levels: { level: string; count: number }[];
    entries: Paginated<LogEntry>;
}

const levelTone: Record<string, string> = {
    emergency: 'text-signal-error',
    alert: 'text-signal-error',
    critical: 'text-signal-error',
    error: 'text-signal-error',
    warning: 'text-signal-warn',
    notice: 'text-chart-5',
    info: 'text-chart-5',
    debug: 'text-muted-foreground',
};

export default function Logs({ filters, levels, entries }: LogsProps) {
    const project = usePage<SharedData>().props.currentProject!;
    const params = { project: project.slug };
    const [search, setSearch] = useState(filters.search);

    const visit = (query: Record<string, string | null>) => {
        router.get(route('logs.index', params), { ...filters, ...query }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        visit({ search });
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: project.name, href: route('projects.show', params) },
                { title: 'Logs', href: route('logs.index', params) },
            ]}
        >
            <Head title={`${project.name} · Logs`} />
            <div className="flex flex-col gap-5 p-4 md:p-6">
                <PageHeader title="Logs" description="Entries the agent captured from the app's log channels.">
                    <form onSubmit={submit} role="search">
                        <label htmlFor="log-search" className="sr-only">
                            Search messages
                        </label>
                        <Input
                            id="log-search"
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search messages…"
                            className="h-8 w-64"
                        />
                    </form>
                </PageHeader>

                <div role="group" aria-label="Level" className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant={filters.level ? 'outline' : 'secondary'}
                        aria-pressed={!filters.level}
                        onClick={() => visit({ level: null })}
                    >
                        All
                    </Button>
                    {levels.map(({ level, count }) => (
                        <Button
                            key={level}
                            size="sm"
                            variant={filters.level === level ? 'secondary' : 'outline'}
                            aria-pressed={filters.level === level}
                            onClick={() => visit({ level })}
                            className="gap-2"
                        >
                            <span className={levelTone[level]}>{level}</span>
                            <span className="text-muted-foreground font-mono text-xs">{formatInteger(count)}</span>
                        </Button>
                    ))}
                </div>

                <Panel title="Entries" aside={<span className="text-muted-foreground text-xs">level counts cover the last 24h</span>}>
                    {entries.data.length ? (
                        <ul className="font-mono text-xs">
                            {entries.data.map((entry) => (
                                <LogRow key={entry.id} entry={entry} />
                            ))}
                        </ul>
                    ) : (
                        <EmptyRow>No log entries match.</EmptyRow>
                    )}
                    {(entries.prev_page_url || entries.next_page_url) && (
                        <nav aria-label="Pagination" className="flex justify-between border-t px-4 py-3 text-sm">
                            {entries.prev_page_url ? (
                                <Link href={entries.prev_page_url} preserveScroll className="text-primary hover:underline">
                                    ← Newer
                                </Link>
                            ) : (
                                <span />
                            )}
                            {entries.next_page_url && (
                                <Link href={entries.next_page_url} preserveScroll className="text-primary hover:underline">
                                    Older →
                                </Link>
                            )}
                        </nav>
                    )}
                </Panel>
            </div>
        </AppLayout>
    );
}

function LogRow({ entry }: { entry: LogEntry }) {
    const hasContext = entry.context && Object.keys(entry.context).length > 0;

    const row = (
        <div className="grid grid-cols-[150px_72px_minmax(0,1fr)] items-baseline gap-3 px-4 py-2 max-md:grid-cols-[72px_minmax(0,1fr)]">
            <span className="text-muted-foreground max-md:hidden">{formatDateTime(entry.logged_at)}</span>
            <span className={cn('font-semibold uppercase', levelTone[entry.level])}>{entry.level}</span>
            <span className="min-w-0 break-words whitespace-pre-wrap">
                {entry.message}
                {entry.hostname && <span className="text-muted-foreground ml-2">· {entry.hostname}</span>}
            </span>
        </div>
    );

    return (
        <li className="border-t first:border-t-0">
            {hasContext ? (
                <details className="group">
                    <summary className="hover:bg-accent/50 cursor-pointer list-none">{row}</summary>
                    <pre className="bg-muted mx-4 mb-3 overflow-x-auto rounded border p-3 text-[11px] leading-relaxed">
                        {JSON.stringify(entry.context, null, 2)}
                    </pre>
                </details>
            ) : (
                row
            )}
        </li>
    );
}
