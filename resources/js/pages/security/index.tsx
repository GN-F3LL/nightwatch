import { PageHeader } from '@/components/signal/page-header';
import { EmptyRow, Panel } from '@/components/signal/panel';
import { SeverityBadge } from '@/components/signal/severity-badge';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { formatDate, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Advisory, type ComponentReport, type ProjectSecurity, type SecuritySummary } from '@/types';
import { Head, Link, router, usePoll } from '@inertiajs/react';
import { ArrowCircleUpIcon, ArrowsClockwiseIcon, CheckCircleIcon, CircleNotchIcon, WarningIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

interface SecurityProps {
    components: ComponentReport[];
    summary: SecuritySummary;
    projects: ProjectSecurity[];
    project: ProjectSecurity | null;
    nvdKey: boolean;
}

const statusLabels: Record<ComponentReport['status'], { label: string; className: string }> = {
    vulnerable: { label: 'Vulnerable', className: 'bg-signal-error/15 text-signal-error' },
    eol: { label: 'End of life', className: 'bg-signal-error/15 text-signal-error' },
    outdated: { label: 'Patch available', className: 'bg-signal-warn/15 text-signal-warn' },
    pending: { label: 'Not checked yet', className: 'bg-muted text-muted-foreground' },
    ok: { label: 'Up to date', className: 'bg-signal-online/15 text-signal-online' },
};

export default function Security({ components, summary, projects, project, nvdKey }: SecurityProps) {
    const [starting, setStarting] = useState(false);
    const running = summary.running || starting;

    // Follow a running check until it finishes...
    const { start, stop } = usePoll(4_000, { only: ['components', 'summary', 'projects', 'project'] }, { autoStart: false });

    useEffect(() => {
        if (running) start();
        else stop();
    }, [running, start, stop]);

    useEffect(() => {
        if (summary.running) setStarting(false);
    }, [summary.running]);

    const checkNow = () => {
        setStarting(true);
        router.post(route('security.scan'), {}, { preserveScroll: true, onFinish: () => setTimeout(() => setStarting(false), 4_000) });
    };

    const attention = components.filter((c) => c.status !== 'ok');
    const healthy = components.filter((c) => c.status === 'ok');

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Vulnerability check', href: route('security.index') },
                ...(project ? [{ title: project.name, href: route('security.index', { project: project.slug }) }] : []),
            ]}
        >
            <Head title={project ? `${project.name} · Vulnerability check` : 'Vulnerability check'} />
            <div className="flex flex-col gap-5 p-4 md:p-6">
                <PageHeader
                    title={
                        project ? (
                            <span className="flex flex-wrap items-center gap-2">
                                Vulnerability check
                                <span className="bg-signal-accent/15 text-signal-accent rounded-md px-2 py-0.5 text-base">{project.name}</span>
                            </span>
                        ) : (
                            'Vulnerability check'
                        )
                    }
                    description={
                        summary.checked_at
                            ? `Known CVEs and support status for the ${summary.total} versions ${project ? `${project.name} runs` : 'your hosts run'} · checked ${timeAgo(summary.checked_at)}`
                            : 'Known CVEs and support status for the versions your hosts run.'
                    }
                >
                    <Button size="sm" onClick={checkNow} disabled={running || components.length === 0}>
                        {running ? <CircleNotchIcon className="animate-spin" /> : <ArrowsClockwiseIcon />}
                        {running ? 'Checking…' : 'Check now'}
                    </Button>
                </PageHeader>

                {running && (
                    <p className="border-signal-accent/40 bg-signal-accent/5 text-foreground/90 rounded-lg border px-4 py-3 text-sm">
                        Checking {summary.total} versions against OSV.dev, the NVD and endoflife.date.{' '}
                        {nvdKey ? 'This takes a few seconds.' : 'The NVD limits requests without an API key, so this takes about a minute.'}
                    </p>
                )}

                {projects.length > 0 && <ProjectsTable projects={projects} selected={project?.slug ?? null} />}

                <div className="bg-border grid gap-px overflow-hidden rounded-lg border sm:grid-cols-3 xl:grid-cols-6">
                    <Tile label="Critical" value={summary.critical} tone="error" />
                    <Tile label="High" value={summary.high} tone="error" />
                    <Tile label="Medium" value={summary.medium} tone="warn" />
                    <Tile label="Low / unrated" value={summary.low + summary.unknown} />
                    <Tile label="End of life" value={summary.eol} tone="error" />
                    <Tile label="Patch available" value={summary.outdated} tone="warn" />
                </div>

                {components.length === 0 ? (
                    <Panel title="Components">
                        <EmptyRow>No host has reported its versions yet.</EmptyRow>
                    </Panel>
                ) : (
                    <>
                        {attention.map((component) => (
                            <ComponentPanel key={component.key} component={component} />
                        ))}

                        {healthy.length > 0 && (
                            <Panel title="Up to date" bodyClassName="flex flex-wrap gap-2 p-4">
                                {healthy.map((c) => (
                                    <span
                                        key={c.key}
                                        title={c.hosts.map((h) => `${h.project.name} · ${h.hostname}`).join('\n')}
                                        className="text-foreground/80 inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-xs"
                                    >
                                        <CheckCircleIcon className="text-signal-online size-3.5" />
                                        {c.name} {c.version}
                                    </span>
                                ))}
                            </Panel>
                        )}
                    </>
                )}

                <p className="text-muted-foreground max-w-4xl text-xs leading-relaxed">
                    Laravel and Composer are checked on OSV.dev, PHP, Node.js, databases and web servers on the NVD, and release support on
                    endoflife.date. Versions are checked every hour when new, then once a day. Packages from Linux distributions (apt, dnf) often
                    carry backported security fixes without a new version number, so confirm CVEs for OS-packaged PHP, MySQL, nginx or Apache against
                    your distribution&apos;s security tracker.
                </p>
            </div>
        </AppLayout>
    );
}

/**
 * Which project has what to fix; a row filters the page to that project.
 */
function ProjectsTable({ projects, selected }: { projects: ProjectSecurity[]; selected: string | null }) {
    const count = (value: number, tone: 'error' | 'warn') =>
        value > 0 ? (
            <span className={cn('font-semibold', tone === 'error' ? 'text-signal-error' : 'text-signal-warn')}>{value}</span>
        ) : (
            <span className="text-muted-foreground">0</span>
        );

    return (
        <Panel
            title="By project"
            aside={
                selected && (
                    <Link href={route('security.index')} className="text-primary text-xs hover:underline">
                        Show all projects
                    </Link>
                )
            }
        >
            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[13px]">
                    <thead>
                        <tr className="text-muted-foreground text-left text-[11px] tracking-wide uppercase">
                            <th className="px-4 py-2 font-medium">Project</th>
                            <th className="px-3 py-2 text-right font-medium">To update</th>
                            <th className="px-3 py-2 text-right font-medium">Critical</th>
                            <th className="px-3 py-2 text-right font-medium">High</th>
                            <th className="px-3 py-2 text-right font-medium">Medium</th>
                            <th className="px-3 py-2 text-right font-medium">End of life</th>
                            <th className="px-4 py-2 text-right font-medium">Patches</th>
                        </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                        {projects.map((p) => (
                            <tr key={p.slug} className={cn('hover:bg-accent/40 border-t', p.slug === selected && 'bg-signal-accent/10')}>
                                <td className="px-4 py-2.5 font-sans">
                                    <Link
                                        href={route('security.index', { project: p.slug })}
                                        preserveScroll
                                        className={cn('font-semibold hover:underline', p.slug === selected && 'text-signal-accent')}
                                    >
                                        {p.name}
                                    </Link>
                                    <span className="text-muted-foreground ml-2 text-[11px]">{p.components} components</span>
                                </td>
                                <td className="px-3 py-2.5 text-right">{count(p.to_update, p.critical + p.high > 0 ? 'error' : 'warn')}</td>
                                <td className="px-3 py-2.5 text-right">{count(p.critical, 'error')}</td>
                                <td className="px-3 py-2.5 text-right">{count(p.high, 'error')}</td>
                                <td className="px-3 py-2.5 text-right">{count(p.medium, 'warn')}</td>
                                <td className="px-3 py-2.5 text-right">{count(p.eol, 'error')}</td>
                                <td className="px-4 py-2.5 text-right">{count(p.outdated, 'warn')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Panel>
    );
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'error' | 'warn' }) {
    return (
        <div className="bg-card flex flex-col gap-1 p-4">
            <span className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</span>
            <span
                className={cn(
                    'font-mono text-2xl font-semibold',
                    value > 0 && tone === 'error' && 'text-signal-error',
                    value > 0 && tone === 'warn' && 'text-signal-warn',
                )}
            >
                {value}
            </span>
        </div>
    );
}

function ComponentPanel({ component }: { component: ComponentReport }) {
    const status = statusLabels[component.status];
    const urgent = component.status === 'vulnerable' || component.status === 'eol';

    // Hosts grouped under the project they belong to...
    const projects = Object.values(
        component.hosts.reduce<Record<string, { name: string; slug: string; hosts: string[] }>>((acc, h) => {
            acc[h.project.slug] ??= { ...h.project, hosts: [] };
            acc[h.project.slug].hosts.push(h.hostname);
            return acc;
        }, {}),
    );

    return (
        <Panel
            title={
                <span className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground font-mono text-sm">
                        {component.name} {component.version}
                    </span>
                    <span className="text-muted-foreground text-xs font-normal">in</span>
                    {projects.map((p) => (
                        <Link
                            key={p.slug}
                            href={route('security.index', { project: p.slug })}
                            className="bg-signal-accent/15 text-signal-accent rounded px-1.5 py-0.5 text-xs font-semibold hover:underline"
                        >
                            {p.name}
                        </Link>
                    ))}
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase', status.className)}>
                        {status.label}
                    </span>
                    {component.status === 'vulnerable' && component.eol && (
                        <span className="bg-signal-error/15 text-signal-error rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                            End of life
                        </span>
                    )}
                </span>
            }
            aside={
                <span className="text-muted-foreground text-xs">
                    {component.advisories.length > 0 &&
                        `${component.advisories.length} ${component.advisories.length === 1 ? 'advisory' : 'advisories'} · `}
                    {component.hosts.length} {component.hosts.length === 1 ? 'host' : 'hosts'}
                </span>
            }
        >
            <div className="flex flex-col gap-2 px-4 py-3">
                {component.recommendation && (
                    <p className={cn('flex items-start gap-2 text-sm font-medium', urgent ? 'text-signal-error' : 'text-signal-warn')}>
                        <ArrowCircleUpIcon className="mt-0.5 size-4 shrink-0" />
                        {component.recommendation}
                    </p>
                )}
                <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {projects.map((p) => (
                        <span key={p.slug}>
                            <Link href={route('projects.show', { project: p.slug })} className="text-foreground/80 font-semibold hover:underline">
                                {p.name}
                            </Link>{' '}
                            on <span className="font-mono">{p.hosts.join(', ')}</span>
                        </span>
                    ))}
                </p>
                {component.eol_date && (
                    <p className="text-muted-foreground text-xs">
                        Security support {component.eol ? 'ended' : 'ends'} {formatDate(component.eol_date)}.
                    </p>
                )}
                {component.error && (
                    <p className="text-signal-warn flex items-center gap-1.5 text-xs">
                        <WarningIcon className="size-3.5" /> {component.error}
                    </p>
                )}
            </div>
            {component.advisories.length > 0 && <AdvisoryTable advisories={component.advisories} />}
        </Panel>
    );
}

function AdvisoryTable({ advisories }: { advisories: Advisory[] }) {
    const [expanded, setExpanded] = useState(false);
    const visible = expanded ? advisories : advisories.slice(0, 6);

    return (
        <div className="border-t">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-[13px]">
                    <thead>
                        <tr className="text-muted-foreground text-left text-[11px] tracking-wide uppercase">
                            <th className="px-4 py-2 font-medium">Severity</th>
                            <th className="px-3 py-2 font-medium">Advisory</th>
                            <th className="px-3 py-2 font-medium">Summary</th>
                            <th className="px-3 py-2 font-medium">Fixed in</th>
                            <th className="px-4 py-2 text-right font-medium">Published</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((a) => (
                            <tr key={a.id} className="border-t align-top">
                                <td className="px-4 py-2.5">
                                    <SeverityBadge severity={a.severity} score={a.score} />
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                    <a href={a.url} target="_blank" rel="noreferrer" className="text-primary font-mono text-xs hover:underline">
                                        {a.id}
                                    </a>
                                </td>
                                <td className="text-foreground/80 px-3 py-2.5">
                                    <span className="line-clamp-2" title={a.summary}>
                                        {a.summary}
                                    </span>
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                                    {a.fixed_in ?? <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="text-muted-foreground px-4 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                                    {a.published_at ? formatDate(a.published_at) : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {advisories.length > 6 && (
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="text-primary w-full border-t px-4 py-2.5 text-left text-xs hover:underline"
                >
                    {expanded ? 'Show fewer' : `Show all ${advisories.length} advisories`}
                </button>
            )}
        </div>
    );
}
