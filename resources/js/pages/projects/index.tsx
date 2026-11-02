import InputError from '@/components/input-error';
import { PageHeader } from '@/components/signal/page-header';
import { VersionBadge } from '@/components/signal/version-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { formatCompact, formatInteger, formatPercent, timeAgo, usageFill, usageTone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Certificate, type Host, type ProjectSecurity, type SecuritySummary, type Version } from '@/types';
import { Head, Link, useForm, usePoll } from '@inertiajs/react';
import { LockSimpleIcon, MagnifyingGlassIcon, PlusIcon, ShieldCheckIcon, ShieldWarningIcon } from '@phosphor-icons/react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

interface ProjectRow {
    id: number;
    name: string;
    slug: string;
    environment: string;
    last_seen_at: string | null;
    certificate: Certificate | null;
    security: ProjectSecurity | null;
    exceptions_24h: number;
    exception_groups_24h: number;
    requests_24h: number;
    server_errors_24h: number;
    unresolved_exceptions: number;
    /** [requests, 5xx] per bar over the last 24 hours. */
    requests_trend: [number, number][];
    hosts: Host[];
}

type HealthLevel = 'critical' | 'attention' | 'healthy' | 'offline' | 'waiting';

interface Health {
    level: HealthLevel;
    reasons: string[];
}

type Filter = 'all' | 'attention' | 'healthy' | 'offline';

const SSL_WARN_DAYS = 21;
const SSL_CRITICAL_DAYS = 7;

const healthStyles: Record<HealthLevel, { label: string; pill: string; dot: string }> = {
    critical: { label: 'Critical', pill: 'bg-signal-error/15 text-signal-error', dot: 'bg-signal-error ring-signal-error/15' },
    attention: { label: 'Needs attention', pill: 'bg-signal-warn/15 text-signal-warn', dot: 'bg-signal-warn ring-signal-warn/15' },
    healthy: { label: 'Healthy', pill: 'bg-signal-online/12 text-signal-online', dot: 'bg-signal-online ring-signal-online/12' },
    offline: { label: 'Offline', pill: 'bg-secondary text-muted-foreground', dot: 'bg-muted-foreground/60 ring-transparent' },
    waiting: { label: 'Waiting for agent', pill: 'bg-secondary text-muted-foreground', dot: 'bg-muted-foreground/40 ring-transparent' },
};

const healthOrder: Record<HealthLevel, number> = { critical: 0, attention: 1, offline: 2, healthy: 3, waiting: 4 };

const filters: { key: Filter; label: string; test: (h: Health) => boolean }[] = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'attention', label: 'Needs attention', test: (h) => h.level === 'critical' || h.level === 'attention' },
    { key: 'healthy', label: 'Healthy', test: (h) => h.level === 'healthy' },
    { key: 'offline', label: 'Offline', test: (h) => h.level === 'offline' || h.level === 'waiting' },
];

export default function Projects({ projects, security }: { projects: ProjectRow[]; security: SecuritySummary }) {
    const [creating, setCreating] = useState(() => new URLSearchParams(window.location.search).has('create'));
    const [filter, setFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');

    const rows = useMemo(
        () =>
            projects
                .map((project) => ({ project, health: assess(project) }))
                .sort((a, b) => healthOrder[a.health.level] - healthOrder[b.health.level] || a.project.name.localeCompare(b.project.name)),
        [projects],
    );

    const query = search.trim().toLowerCase();
    const visible = rows.filter(
        ({ project, health }) =>
            filters.find((f) => f.key === filter)!.test(health) && (!query || `${project.name} ${project.environment}`.toLowerCase().includes(query)),
    );

    return (
        <AppLayout breadcrumbs={[{ title: 'Projects', href: route('projects.index') }]}>
            <Head title="Projects" />
            <div className="flex flex-col gap-5 p-4 md:p-6">
                <PageHeader
                    title="Projects"
                    description={projects.length ? 'Every Laravel app you monitor, worst first.' : 'Nothing is being monitored yet.'}
                >
                    {projects.length > 0 && <LiveIndicator data={projects} />}
                    <VulnerabilityButton summary={security} />
                    <Button size="sm" onClick={() => setCreating(true)}>
                        <PlusIcon /> New project
                    </Button>
                </PageHeader>

                {projects.length === 0 ? (
                    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border px-6 py-16 text-center">
                        <h2 className="text-lg font-semibold">Add your first Laravel project</h2>
                        <p className="text-muted-foreground max-w-md text-sm">
                            Each project gets an ingest token. Install the agent package in the Laravel app, set the token, and its servers, versions,
                            exceptions and logs start showing up here within a minute.
                        </p>
                        <Button onClick={() => setCreating(true)}>
                            <PlusIcon /> New project
                        </Button>
                    </div>
                ) : (
                    <>
                        <FleetSummary projects={projects} security={security} />

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div role="group" aria-label="Filter projects" className="bg-card flex gap-0.5 rounded-lg border p-[3px]">
                                {filters.map((f) => (
                                    <button
                                        key={f.key}
                                        type="button"
                                        aria-pressed={filter === f.key}
                                        onClick={() => setFilter(f.key)}
                                        className={cn(
                                            'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition-colors',
                                            filter === f.key ? 'bg-secondary text-foreground' : 'text-foreground/75 hover:text-foreground',
                                        )}
                                    >
                                        {f.label}
                                        <span className="font-mono text-[11px] opacity-70">{rows.filter((r) => f.test(r.health)).length}</span>
                                    </button>
                                ))}
                            </div>
                            <label className="bg-card text-muted-foreground flex h-9 w-72 max-w-full items-center gap-2 rounded-lg border px-3 text-sm">
                                <MagnifyingGlassIcon className="size-4 shrink-0" />
                                <span className="sr-only">Search projects</span>
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search projects"
                                    className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
                                />
                            </label>
                        </div>

                        <section className="bg-card overflow-hidden rounded-lg border">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1240px] text-[13px]">
                                    <thead>
                                        <tr className="text-muted-foreground bg-background/40 text-left text-[11px] tracking-wide uppercase">
                                            <th className="px-4 py-3 font-medium">Project</th>
                                            <th className="px-3 py-3 font-medium">Health</th>
                                            <th className="px-3 py-3 font-medium">Requests 24h</th>
                                            <th className="px-3 py-3 text-right font-medium">5xx</th>
                                            <th className="px-3 py-3 text-right font-medium">Exceptions</th>
                                            <th className="px-3 py-3 font-medium">CPU · RAM · Disk</th>
                                            <th className="px-3 py-3 font-medium">Stack</th>
                                            <th className="px-4 py-3 font-medium">Security</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visible.map(({ project, health }) => (
                                            <ProjectRowView key={project.id} project={project} health={health} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {visible.length === 0 && (
                                <p className="text-muted-foreground px-4 py-10 text-center text-sm">No projects match this filter.</p>
                            )}
                        </section>
                    </>
                )}
            </div>

            <CreateProjectDialog open={creating} onOpenChange={setCreating} />
        </AppLayout>
    );
}

/**
 * Overall health of a project, with the reasons behind it, from what its hosts and checks report.
 */
function assess(project: ProjectRow): Health {
    if (!project.last_seen_at) {
        return { level: 'waiting', reasons: ['No report from the agent yet'] };
    }

    const critical: string[] = [];
    const attention: string[] = [];
    const s = project.security;

    if (s?.critical) critical.push(`${s.critical} critical ${s.critical === 1 ? 'CVE' : 'CVEs'}`);
    if (s?.high) critical.push(`${s.high} high-severity ${s.high === 1 ? 'CVE' : 'CVEs'}`);
    if (s?.eol) critical.push(`${s.eol} end-of-life ${s.eol === 1 ? 'component' : 'components'}`);
    if (s && s.to_update > 0 && !s.critical && !s.high) attention.push(`${s.to_update} ${s.to_update === 1 ? 'component' : 'components'} to update`);
    if (s && s.outdated > 0) attention.push(`${s.outdated} patch ${s.outdated === 1 ? 'release' : 'releases'} available`);

    for (const host of project.hosts.filter((h) => h.online)) {
        for (const [label, value] of [
            ['CPU', host.cpu_percent],
            ['RAM', host.memory_percent],
            ['Disk', host.disk_percent],
        ] as const) {
            if (value === null) continue;
            if (value >= 90) critical.push(`${label} ${Math.round(value)}% on ${host.hostname}`);
            else if (value >= 80) attention.push(`${label} ${Math.round(value)}% on ${host.hostname}`);
        }
    }

    const days = project.certificate?.days_left;
    if (days !== undefined && days <= SSL_CRITICAL_DAYS) critical.push(days < 0 ? 'SSL certificate expired' : `SSL expires in ${days} days`);
    else if (days !== undefined && days <= SSL_WARN_DAYS) attention.push(`SSL expires in ${days} days`);

    if (project.server_errors_24h > 0) attention.push(`${formatInteger(project.server_errors_24h)} server errors in 24h`);
    if (project.exceptions_24h > 0) attention.push(`${formatInteger(project.exceptions_24h)} exceptions in 24h`);

    if (!project.hosts.some((h) => h.online)) {
        return { level: 'offline', reasons: [`No report since ${timeAgo(project.last_seen_at)}`, ...critical, ...attention] };
    }

    if (critical.length) return { level: 'critical', reasons: [...critical, ...attention] };
    if (attention.length) return { level: 'attention', reasons: attention };

    return { level: 'healthy', reasons: [] };
}

function ProjectRowView({ project, health }: { project: ProjectRow; health: Health }) {
    const style = healthStyles[health.level];
    const online = project.hosts.filter((h) => h.online);
    const reporting = health.level !== 'waiting';

    return (
        <tr className={cn('hover:bg-accent/30 border-t transition-colors', health.level === 'offline' && 'opacity-70')}>
            <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                    <span className={cn('size-2 shrink-0 rounded-full ring-4', style.dot)} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                            href={route('projects.show', { project: project.slug })}
                            className="text-foreground truncate text-sm font-semibold hover:underline"
                        >
                            {project.name}
                        </Link>
                        <span className="text-muted-foreground font-mono text-[11px]">
                            {project.environment} · {project.hosts.length > 0 ? `${online.length}/${project.hosts.length}` : 'no'}{' '}
                            {project.hosts.length === 1 ? 'host' : 'hosts'}
                        </span>
                    </div>
                </div>
            </td>
            <td className="px-3 py-3.5">
                <div className="flex max-w-56 flex-col items-start gap-1">
                    {health.level === 'waiting' ? (
                        <Link
                            href={route('projects.setup', { project: project.slug })}
                            className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold hover:underline', style.pill)}
                        >
                            {style.label}
                        </Link>
                    ) : (
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', style.pill)}>
                            {style.label}
                            {health.level === 'offline' && project.last_seen_at && ` · ${timeAgo(project.last_seen_at)}`}
                        </span>
                    )}
                    {health.reasons.length > 0 && (
                        <span className="text-muted-foreground w-full truncate text-[11px]" title={health.reasons.join('\n')}>
                            {health.reasons[health.level === 'offline' ? 1 : 0] ?? health.reasons[0]}
                            {health.reasons.length > 1 && ` +${health.reasons.length - 1}`}
                        </span>
                    )}
                </div>
            </td>
            <td className="px-3 py-3.5">
                {reporting ? (
                    <div className="flex items-center gap-3">
                        <TrendBars values={project.requests_trend} />
                        <span className="font-mono font-semibold">{formatCompact(project.requests_24h)}</span>
                    </div>
                ) : (
                    <Muted />
                )}
            </td>
            <td
                className={cn(
                    'px-3 py-3.5 text-right font-mono font-semibold',
                    project.server_errors_24h > 0 ? 'text-signal-error' : 'text-muted-foreground',
                )}
            >
                {reporting ? formatCompact(project.server_errors_24h) : '—'}
            </td>
            <td className="px-3 py-3.5 text-right whitespace-nowrap">
                {reporting ? (
                    <>
                        <span className={cn('font-mono font-semibold', project.exceptions_24h > 0 ? 'text-signal-error' : 'text-muted-foreground')}>
                            {formatCompact(project.exceptions_24h)}
                        </span>
                        {project.exceptions_24h > 0 && (
                            <Link
                                href={route('exceptions.index', { project: project.slug })}
                                className="text-muted-foreground ml-1.5 text-[11px] hover:underline"
                                title="Events are grouped by class and location"
                            >
                                {project.exception_groups_24h} unique
                            </Link>
                        )}
                    </>
                ) : (
                    <Muted />
                )}
            </td>
            <td className="px-3 py-3.5">{project.hosts.length > 0 ? <Resources hosts={online.length ? online : project.hosts} /> : <Muted />}</td>
            <td className="px-3 py-3.5">
                <Stack hosts={project.hosts} />
            </td>
            <td className="px-4 py-3.5">
                <div className="flex flex-col gap-1 text-xs whitespace-nowrap">
                    <SecurityStatus security={project.security} reporting={reporting} />
                    <CertificateStatus certificate={project.certificate} reporting={reporting} />
                </div>
            </td>
        </tr>
    );
}

function Muted() {
    return <span className="text-muted-foreground">—</span>;
}

/**
 * Requests per bar over the last 24 hours, the 5xx share drawn in red on top.
 */
function TrendBars({ values }: { values: [number, number][] }) {
    const max = Math.max(1, ...values.map(([total]) => total));

    return (
        <div className="flex h-[22px] w-[90px] items-end gap-px" role="img" aria-label="Requests over the last 24 hours">
            {values.map(([total, errors], i) =>
                total === 0 ? (
                    <span key={i} className="bg-signal-track h-px flex-1" />
                ) : (
                    <span
                        key={i}
                        className="flex flex-1 flex-col-reverse overflow-hidden rounded-t-[1px]"
                        style={{ height: `${Math.max(2, (total / max) * 22)}px` }}
                    >
                        <span className="bg-signal-ok" style={{ flexGrow: total - errors }} />
                        {errors > 0 && <span className="bg-signal-error" style={{ flexGrow: errors, minHeight: 1 }} />}
                    </span>
                ),
            )}
        </div>
    );
}

/**
 * The busiest host's CPU, RAM and disk; every host's figures in the tooltip.
 */
function Resources({ hosts }: { hosts: Host[] }) {
    const worst = (pick: (h: Host) => number | null) => {
        const values = hosts.map(pick).filter((v): v is number => v !== null);
        return values.length ? Math.max(...values) : null;
    };

    const meters = [
        { label: 'CPU', value: worst((h) => h.cpu_percent) },
        { label: 'RAM', value: worst((h) => h.memory_percent) },
        { label: 'DSK', value: worst((h) => h.disk_percent) },
    ];

    const detail = hosts
        .map(
            (h) =>
                `${h.hostname}: CPU ${formatPercent(h.cpu_percent)} · RAM ${formatPercent(h.memory_percent)} · Disk ${formatPercent(h.disk_percent)}`,
        )
        .join('\n');

    return (
        <div className="grid w-[216px] grid-cols-3 gap-2.5" title={detail}>
            {meters.map((m) => (
                <div key={m.label} className="flex flex-col gap-1.5">
                    <span className={cn('font-mono text-[11px] font-semibold', usageTone(m.value))}>
                        {m.label} {formatPercent(m.value)}
                    </span>
                    <div className="bg-signal-track h-[3px] overflow-hidden rounded-full">
                        <div className={cn('h-full rounded-full', usageFill(m.value))} style={{ width: `${Math.min(100, m.value ?? 0)}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * One chip per component, taking the least current version when hosts differ.
 */
function Stack({ hosts }: { hosts: Host[] }) {
    if (hosts.length === 0) {
        return <Muted />;
    }

    const severity = { current: 0, behind: 1, eol: 2 };
    const pick = (key: keyof Host['versions']) =>
        hosts
            .map((h) => h.versions[key])
            .filter((v): v is Version => v !== null)
            .sort((a, b) => severity[b.state] - severity[a.state])[0] ?? null;

    const webServer = pick('web_server');

    return (
        <div className="flex max-w-[320px] flex-wrap gap-1">
            <VersionBadge label="PHP" version={pick('php')} />
            <VersionBadge label="Laravel" version={pick('laravel')} />
            <VersionBadge label="Composer" version={pick('composer')} />
            <VersionBadge label="Node" version={pick('node')} />
            <VersionBadge version={pick('database')} />
            {webServer ? (
                <VersionBadge version={webServer} />
            ) : (
                // Only web requests see the server; reports run from the CLI...
                <span
                    className="text-muted-foreground rounded border border-dashed px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap"
                    title="Detected from the app's web requests. Open a page of the app and it shows up with the next report."
                >
                    web server ?
                </span>
            )}
        </div>
    );
}

function SecurityStatus({ security, reporting }: { security: ProjectSecurity | null; reporting: boolean }) {
    if (!reporting) {
        return null;
    }

    if (!security) {
        return (
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3.5" /> Not checked yet
            </span>
        );
    }

    const severe = security.critical + security.high > 0 || security.eol > 0;
    const parts = [
        security.to_update > 0 && `${security.to_update} to update`,
        security.critical > 0 && `${security.critical} critical`,
        security.critical === 0 && security.high > 0 && `${security.high} high`,
        security.to_update === 0 && security.outdated > 0 && `${security.outdated} ${security.outdated === 1 ? 'patch' : 'patches'}`,
    ].filter(Boolean);

    if (parts.length === 0) {
        return (
            <Link
                href={route('security.index', { project: security.slug })}
                className="text-signal-online inline-flex items-center gap-1.5 hover:underline"
            >
                <ShieldCheckIcon className="size-3.5" /> No known CVEs
            </Link>
        );
    }

    return (
        <Link
            href={route('security.index', { project: security.slug })}
            title="Open this project's vulnerability check"
            className={cn('inline-flex items-center gap-1.5 hover:underline', severe ? 'text-signal-error' : 'text-signal-warn')}
        >
            <ShieldWarningIcon className="size-3.5" /> {parts.join(' · ')}
        </Link>
    );
}

function CertificateStatus({ certificate, reporting }: { certificate: Certificate | null; reporting: boolean }) {
    if (!reporting) {
        return null;
    }

    if (!certificate) {
        return (
            <span
                className="text-muted-foreground inline-flex items-center gap-1.5"
                title="The agent checks the certificate of APP_URL when it is https. Set SIGNAL_CERTIFICATE_URL to check another address."
            >
                <LockSimpleIcon className="size-3.5" /> No SSL (http)
            </span>
        );
    }

    const days = certificate.days_left;
    const tone = days <= SSL_CRITICAL_DAYS ? 'text-signal-error' : days <= SSL_WARN_DAYS ? 'text-signal-warn' : 'text-foreground/80';

    return (
        <span
            className={cn('inline-flex items-center gap-1.5', tone)}
            title={[certificate.host, certificate.issuer && `issued by ${certificate.issuer}`].filter(Boolean).join(' · ')}
        >
            <LockSimpleIcon className="size-3.5" />
            {days < 0 ? 'SSL expired' : `SSL ${days} ${days === 1 ? 'day' : 'days'}`}
        </span>
    );
}

/**
 * Projects, hosts, exceptions, components to update and certificates about to expire, across the fleet.
 */
function FleetSummary({ projects, security }: { projects: ProjectRow[]; security: SecuritySummary }) {
    const hosts = projects.flatMap((p) => p.hosts);
    const online = hosts.filter((h) => h.online).length;
    const offline = projects.filter((p) => p.last_seen_at && !p.hosts.some((h) => h.online)).length;
    const exceptions = projects.reduce((n, p) => n + p.exceptions_24h, 0);
    const unique = projects.reduce((n, p) => n + p.exception_groups_24h, 0);
    const toUpdate = security.vulnerable + security.eol;
    const expiring = projects.filter((p) => p.certificate && p.certificate.days_left <= SSL_WARN_DAYS).length;

    const tiles = [
        { label: 'Projects', value: formatInteger(projects.length), note: offline ? `${offline} offline` : 'all reporting' },
        { label: 'Hosts online', value: `${online}/${hosts.length}`, note: 'report every minute' },
        {
            label: 'Exceptions 24h',
            value: formatInteger(exceptions),
            note: exceptions ? `${unique} unique` : 'none',
            tone: exceptions ? 'text-signal-error' : '',
        },
        {
            label: 'To update',
            value: formatInteger(toUpdate),
            note: !security.checked_at
                ? 'not checked yet'
                : security.critical
                  ? `${security.critical} critical ${security.critical === 1 ? 'CVE' : 'CVEs'}`
                  : toUpdate
                    ? `${security.high} high CVEs`
                    : 'no known CVEs',
            tone: toUpdate ? (security.critical + security.high ? 'text-signal-error' : 'text-signal-warn') : '',
            href: route('security.index'),
        },
        { label: 'SSL expiring', value: formatInteger(expiring), note: `within ${SSL_WARN_DAYS} days`, tone: expiring ? 'text-signal-warn' : '' },
    ];

    return (
        <section aria-label="Fleet summary" className="bg-border grid gap-px overflow-hidden rounded-lg border sm:grid-cols-3 xl:grid-cols-5">
            {tiles.map((t) => {
                const body = (
                    <>
                        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{t.label}</span>
                        <span className="flex items-baseline gap-2">
                            <span className={cn('font-mono text-[26px] leading-none font-semibold tracking-tight', t.tone)}>{t.value}</span>
                            <span className="text-muted-foreground text-xs">{t.note}</span>
                        </span>
                    </>
                );

                return t.href ? (
                    <Link key={t.label} href={t.href} className="bg-card hover:bg-accent/40 flex flex-col gap-2.5 px-4 py-4 transition-colors">
                        {body}
                    </Link>
                ) : (
                    <div key={t.label} className="bg-card flex flex-col gap-2.5 px-4 py-4">
                        {body}
                    </div>
                );
            })}
        </section>
    );
}

/**
 * Refreshes the page every 15 seconds while on, and says how fresh the figures are.
 */
function LiveIndicator({ data }: { data: unknown }) {
    const [live, setLive] = useState(true);
    const [updatedAt, setUpdatedAt] = useState(() => Date.now());
    const [now, setNow] = useState(() => Date.now());
    const { start, stop } = usePoll(15_000, {}, { autoStart: true });

    // Every reload hands the page new props...
    useEffect(() => setUpdatedAt(Date.now()), [data]);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 5_000);
        return () => clearInterval(timer);
    }, []);

    const toggle = () => {
        if (live) stop();
        else start();
        setLive(!live);
    };

    const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));

    return (
        <Button
            variant="outline"
            size="sm"
            aria-pressed={live}
            onClick={toggle}
            title={live ? 'Refreshes every 15 seconds. Click to pause.' : 'Paused. Click to refresh every 15 seconds.'}
            className={cn('gap-2 text-xs', live && 'border-signal-online/30 bg-signal-online/5 text-signal-online hover:text-signal-online')}
        >
            <span className={cn('size-1.5 rounded-full', live ? 'bg-signal-online animate-pulse' : 'bg-muted-foreground')} />
            {live ? `Live · updated ${seconds < 5 ? 'just now' : `${seconds}s ago`}` : 'Paused'}
        </Button>
    );
}

/**
 * Opens the vulnerability check; the count is the components to update, red when a critical or high CVE is among them.
 */
function VulnerabilityButton({ summary }: { summary: SecuritySummary }) {
    const toUpdate = summary.vulnerable + summary.eol;
    const severe = summary.critical + summary.high > 0;

    return (
        <Button size="sm" variant="outline" asChild>
            <Link href={route('security.index')}>
                {toUpdate > 0 ? (
                    <ShieldWarningIcon className={severe ? 'text-signal-error' : 'text-signal-warn'} />
                ) : (
                    <ShieldCheckIcon className={summary.checked_at ? 'text-signal-online' : undefined} />
                )}
                Vulnerability check
                {toUpdate > 0 && (
                    <span
                        className={cn(
                            'rounded px-1.5 font-mono text-[11px] font-semibold',
                            severe ? 'bg-signal-error/15 text-signal-error' : 'bg-signal-warn/15 text-signal-warn',
                        )}
                        title={`${summary.critical} critical · ${summary.high} high · ${summary.medium} medium CVEs`}
                    >
                        {toUpdate}
                    </span>
                )}
            </Link>
        </Button>
    );
}

function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { data, setData, post, processing, errors, reset } = useForm({ name: '', environment: 'production' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('projects.store'), { onSuccess: () => reset() });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit} className="flex flex-col gap-5">
                    <DialogHeader>
                        <DialogTitle>New project</DialogTitle>
                        <DialogDescription>Register a Laravel app. You get an ingest token for its agent on the next screen.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="billing-api"
                            autoFocus
                            required
                        />
                        <InputError message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="environment">Environment</Label>
                        <Input id="environment" value={data.environment} onChange={(e) => setData('environment', e.target.value)} required />
                        <InputError message={errors.environment} />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            Create project
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
