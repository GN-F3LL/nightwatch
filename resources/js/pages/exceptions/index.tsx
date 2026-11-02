import { PageHeader } from '@/components/signal/page-header';
import { EmptyRow, Panel } from '@/components/signal/panel';
import { Sparkline } from '@/components/signal/sparkline';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { formatInteger, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type ExceptionGroup, type ExceptionStatus, type Paginated, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';

interface ExceptionsProps {
    filters: { status: ExceptionStatus; search: string };
    counts: Record<ExceptionStatus, number>;
    groups: Paginated<ExceptionGroup>;
}

const DAY = 86_400_000;

export default function Exceptions({ filters, counts, groups }: ExceptionsProps) {
    const project = usePage<SharedData>().props.currentProject!;
    const params = { project: project.slug };
    const [search, setSearch] = useState(filters.search);

    const visit = (query: Partial<ExceptionsProps['filters']>) => {
        router.get(route('exceptions.index', params), { ...filters, ...query }, { preserveState: true, replace: true });
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        visit({ search });
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: project.name, href: route('projects.show', params) },
                { title: 'Exceptions', href: route('exceptions.index', params) },
            ]}
        >
            <Head title={`${project.name} · Exceptions`} />
            <div className="flex flex-col gap-5 p-4 md:p-6">
                <PageHeader title="Exceptions" description="Grouped by class and the place they were thrown.">
                    <form onSubmit={submit} role="search">
                        <label htmlFor="exception-search" className="sr-only">
                            Search exceptions
                        </label>
                        <Input
                            id="exception-search"
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Class, message, file…"
                            className="h-8 w-64"
                        />
                    </form>
                </PageHeader>

                <div role="tablist" aria-label="Status" className="flex gap-1">
                    {(['unresolved', 'resolved', 'ignored'] as const).map((status) => (
                        <button
                            key={status}
                            type="button"
                            role="tab"
                            aria-selected={filters.status === status}
                            onClick={() => visit({ status })}
                            className={cn(
                                'h-9 rounded-md px-3 text-sm font-medium capitalize',
                                filters.status === status ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {status} <span className="text-primary ml-1 font-mono text-xs">{formatInteger(counts[status])}</span>
                        </button>
                    ))}
                </div>

                <Panel
                    title={`${formatInteger(groups.total ?? groups.data.length)} groups`}
                    aside={<span className="text-muted-foreground text-xs">trend: last 14 days</span>}
                >
                    {groups.data.length ? (
                        <ul>
                            {groups.data.map((group) => (
                                <ExceptionRow key={group.id} group={group} href={route('exceptions.show', { ...params, exception: group.id })} />
                            ))}
                        </ul>
                    ) : (
                        <EmptyRow>{filters.status === 'unresolved' ? 'Nothing unresolved. Nice.' : `No ${filters.status} exceptions.`}</EmptyRow>
                    )}
                    {(groups.prev_page_url || groups.next_page_url) && (
                        <nav aria-label="Pagination" className="flex items-center justify-between border-t px-4 py-3 text-sm">
                            {groups.prev_page_url ? (
                                <Link href={groups.prev_page_url} className="text-primary hover:underline">
                                    ← Previous
                                </Link>
                            ) : (
                                <span />
                            )}
                            <span className="text-muted-foreground text-xs">
                                Page {groups.current_page} of {groups.last_page}
                            </span>
                            {groups.next_page_url ? (
                                <Link href={groups.next_page_url} className="text-primary hover:underline">
                                    Next →
                                </Link>
                            ) : (
                                <span />
                            )}
                        </nav>
                    )}
                </Panel>
            </div>
        </AppLayout>
    );
}

function ExceptionRow({ group, href }: { group: ExceptionGroup; href: string }) {
    const isNew = Date.now() - new Date(group.first_seen_at).getTime() < DAY;
    const regressed = group.regressed_at !== null && group.status === 'unresolved';
    const recent = group.trend.slice(-2).reduce((a, b) => a + b, 0);

    return (
        <li className="border-t first:border-t-0">
            <Link href={href} className="hover:bg-accent/40 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2">
                    {regressed && <Tag className="bg-signal-error/15 text-signal-error">Regressed</Tag>}
                    {isNew && !regressed && <Tag className="bg-primary/15 text-primary">New</Tag>}
                    <span className="truncate font-mono text-[13px] font-semibold">{group.class}</span>
                </span>
                <span className={cn('row-span-2 flex items-center gap-4', recent > 0 ? 'text-signal-error' : 'text-muted-foreground')}>
                    <Sparkline values={group.trend} label="Daily occurrences, last 14 days" />
                    <span className="flex w-14 flex-col items-end">
                        <span className="font-mono text-sm font-semibold">{formatInteger(group.occurrences)}</span>
                        <span className="text-muted-foreground text-[10px]">{group.occurrences === 1 ? 'event' : 'events'}</span>
                    </span>
                </span>
                <span className="text-foreground/75 truncate text-sm">{group.message}</span>
                <span className="text-muted-foreground col-span-2 flex flex-wrap gap-x-3 font-mono text-[11px]">
                    {group.file && (
                        <span>
                            {group.file}:{group.line}
                        </span>
                    )}
                    <span>last {timeAgo(group.last_seen_at)}</span>
                    <span>first {timeAgo(group.first_seen_at)}</span>
                </span>
            </Link>
        </li>
    );
}

function Tag({ className, children }: { className: string; children: React.ReactNode }) {
    return <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase', className)}>{children}</span>;
}
