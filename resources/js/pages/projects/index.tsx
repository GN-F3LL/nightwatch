import InputError from '@/components/input-error';
import { CertificateBadge } from '@/components/signal/certificate-badge';
import { Meter } from '@/components/signal/meter';
import { PageHeader } from '@/components/signal/page-header';
import { StatusDot } from '@/components/signal/status-dot';
import { VersionBadge } from '@/components/signal/version-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { formatCompact, formatInteger, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Certificate, type Host, type ProjectSecurity, type SecuritySummary } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { PlusIcon, ShieldCheckIcon, ShieldWarningIcon } from '@phosphor-icons/react';
import { FormEventHandler, useState } from 'react';

interface ProjectCard {
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
    hosts: Host[];
}

export default function Projects({ projects, security }: { projects: ProjectCard[]; security: SecuritySummary }) {
    const [creating, setCreating] = useState(() => new URLSearchParams(window.location.search).has('create'));

    const onlineHosts = projects.reduce((n, p) => n + p.hosts.filter((h) => h.online).length, 0);
    const totalHosts = projects.reduce((n, p) => n + p.hosts.length, 0);
    const exceptions = projects.reduce((n, p) => n + p.exceptions_24h, 0);

    return (
        <AppLayout breadcrumbs={[{ title: 'Projects', href: route('projects.index') }]}>
            <Head title="Projects" />
            <div className="flex flex-col gap-5 p-4 md:p-6">
                <PageHeader
                    title="Projects"
                    description={
                        projects.length ? (
                            <>
                                {projects.length} projects · {onlineHosts}/{totalHosts} hosts online ·{' '}
                                <span className={cn(exceptions > 0 && 'text-signal-error font-medium')}>
                                    {formatInteger(exceptions)} exception events in 24h
                                </span>
                            </>
                        ) : (
                            'Nothing is being monitored yet.'
                        )
                    }
                >
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
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {projects.map((project) => (
                            <ProjectTile key={project.id} project={project} />
                        ))}
                    </div>
                )}
            </div>

            <CreateProjectDialog open={creating} onOpenChange={setCreating} />
        </AppLayout>
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

/**
 * The project's components to update and its worst CVEs, linking to the vulnerability check filtered to it.
 */
function SecurityChip({ security }: { security: ProjectSecurity | null }) {
    if (!security || security.to_update + security.outdated === 0) {
        return null;
    }

    const severe = security.critical + security.high > 0;
    const parts = [
        security.to_update > 0 && `${security.to_update} to update`,
        security.critical > 0 && `${security.critical} critical`,
        security.high > 0 && `${security.high} high`,
        security.to_update === 0 && `${security.outdated} patch${security.outdated === 1 ? '' : 'es'}`,
    ].filter(Boolean);

    return (
        <Link
            href={route('security.index', { project: security.slug })}
            title="Open this project's vulnerability check"
            className={cn(
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap hover:underline',
                severe || security.eol > 0 ? 'border-signal-error/40 text-signal-error' : 'border-signal-warn/40 text-signal-warn',
            )}
        >
            <ShieldWarningIcon className="size-3" />
            {parts.join(' · ')}
        </Link>
    );
}

function ProjectTile({ project }: { project: ProjectCard }) {
    const online = project.hosts.some((h) => h.online);
    const host = project.hosts[0];

    return (
        <article className={cn('bg-card flex flex-col gap-4 rounded-lg border p-4', !online && project.last_seen_at && 'opacity-70')}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <Link href={route('projects.show', { project: project.slug })} className="truncate font-semibold hover:underline">
                        {project.name}
                    </Link>
                    <span className="text-muted-foreground font-mono text-xs">
                        {project.environment} · {project.hosts.length} {project.hosts.length === 1 ? 'host' : 'hosts'}
                    </span>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-xs">
                    <StatusDot online={online} />
                    {project.last_seen_at ? (online ? 'Online' : `Offline · ${timeAgo(project.last_seen_at)}`) : 'Waiting for agent'}
                </span>
            </div>

            {host ? (
                <>
                    <div className="grid grid-cols-3 gap-3">
                        <Meter label="CPU" value={host.cpu_percent} />
                        <Meter label="RAM" value={host.memory_percent} />
                        <Meter label="DISK" value={host.disk_percent} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {host.os && <span className="text-foreground/80 rounded border px-1.5 py-0.5 font-mono text-[11px]">{host.os}</span>}
                        <VersionBadge label="PHP" version={host.versions.php} />
                        <VersionBadge label="Laravel" version={host.versions.laravel} />
                        <VersionBadge label="Composer" version={host.versions.composer} />
                        <VersionBadge label="Node" version={host.versions.node} />
                        <VersionBadge version={host.versions.database} />
                        <VersionBadge version={host.versions.web_server} />
                        <CertificateBadge certificate={project.certificate} />
                        <SecurityChip security={project.security} />
                    </div>
                </>
            ) : (
                <Link href={route('projects.setup', { project: project.slug })} className="text-primary text-sm hover:underline">
                    Install the agent →
                </Link>
            )}

            <dl className="mt-auto grid grid-cols-3 gap-3 border-t pt-3">
                <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">Requests 24h</dt>
                    <dd className="font-mono text-base font-semibold">{formatCompact(project.requests_24h)}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">5xx 24h</dt>
                    <dd className={cn('font-mono text-base font-semibold', project.server_errors_24h > 0 && 'text-signal-error')}>
                        {formatCompact(project.server_errors_24h)}
                    </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">Exceptions 24h</dt>
                    <dd className="flex items-baseline gap-1.5">
                        <span className={cn('font-mono text-base font-semibold', project.exceptions_24h > 0 && 'text-signal-error')}>
                            {formatCompact(project.exceptions_24h)}
                        </span>
                        {project.exceptions_24h > 0 && (
                            <Link
                                href={route('exceptions.index', { project: project.slug })}
                                className="text-muted-foreground font-mono text-[11px] hover:underline"
                                title="Events are grouped by class and location"
                            >
                                {project.exception_groups_24h} unique
                            </Link>
                        )}
                    </dd>
                </div>
            </dl>
        </article>
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
