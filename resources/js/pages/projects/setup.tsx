import InputError from '@/components/input-error';
import { PageHeader } from '@/components/signal/page-header';
import { Panel } from '@/components/signal/panel';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type SharedData } from '@/types';
import { Head, router, useForm, usePage, usePoll } from '@inertiajs/react';
import { CheckIcon, CircleNotchIcon, CopyIcon } from '@phosphor-icons/react';
import { FormEventHandler, useState } from 'react';

interface SetupProps {
    ingestUrl: string;
    token: string | null;
    hasReported: boolean;
}

export default function Setup({ ingestUrl, token, hasReported }: SetupProps) {
    const project = usePage<SharedData>().props.currentProject!;
    const params = { project: project.slug };

    // Watch for the agent's first report...
    usePoll(5_000, { only: ['hasReported'] }, { autoStart: !hasReported });

    const env = `SIGNAL_URL=${ingestUrl}\nSIGNAL_TOKEN=${token ?? '<your token>'}`;

    return (
        <AppLayout
            breadcrumbs={[
                { title: project.name, href: route('projects.show', params) },
                { title: 'Setup', href: route('projects.setup', params) },
            ]}
        >
            <Head title={`${project.name} · Setup`} />
            <div className="flex max-w-4xl flex-col gap-5 p-4 md:p-6">
                <PageHeader title="Setup" description="Connect a Laravel app to this project." />

                {token && (
                    <div className="border-signal-accent/40 bg-signal-accent/5 flex flex-col gap-3 rounded-lg border p-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-sm font-semibold">Ingest token</h2>
                            <p className="text-muted-foreground text-sm">Copy it now. Only a hash is stored, so it can't be shown again.</p>
                        </div>
                        <CopyField value={token} />
                    </div>
                )}

                <Panel title="Install the agent" bodyClassName="flex flex-col gap-5 p-4 text-sm">
                    <Step n={1} title="Require the package in your Laravel app">
                        <CodeBlock code="composer require signal/laravel-agent:@dev" />
                        <p className="text-muted-foreground">
                            Not on Packagist? Add the <code className="font-mono">packages/signal-agent</code> folder of this repository as a path or
                            VCS repository in the app's <code className="font-mono">composer.json</code> first.
                        </p>
                    </Step>
                    <Step n={2} title="Add the connection to .env">
                        <CodeBlock code={env} />
                    </Step>
                    <Step n={3} title="Make sure the scheduler runs">
                        <p className="text-muted-foreground">
                            The agent reports CPU, memory, disk and versions every minute through the scheduler. Exceptions, logs, requests and jobs
                            are sent as they happen.
                        </p>
                        <CodeBlock code="* * * * * cd /path-to-your-app && php artisan schedule:run >> /dev/null 2>&1" />
                    </Step>
                    <Step n={4} title="Send a test report">
                        <CodeBlock code="php artisan signal:test" />
                        <p className="flex items-center gap-2">
                            {hasReported ? (
                                <>
                                    <CheckIcon className="text-signal-accent size-4" /> The agent has reported.{' '}
                                    <button
                                        type="button"
                                        onClick={() => router.visit(route('projects.show', params))}
                                        className="text-primary hover:underline"
                                    >
                                        Open the dashboard
                                    </button>
                                </>
                            ) : (
                                <>
                                    <CircleNotchIcon className="text-muted-foreground size-4 animate-spin" />
                                    <span className="text-muted-foreground">Waiting for the first report…</span>
                                </>
                            )}
                        </p>
                    </Step>
                </Panel>

                <Panel title="Pause or remove the agent" bodyClassName="flex flex-col gap-5 p-4 text-sm">
                    <Step n={1} title="Pause it">
                        <p className="text-muted-foreground">
                            Set this in the app's <code className="font-mono">.env</code>. Nothing is captured or sent, and{' '}
                            <code className="font-mono">signal:report</code> leaves the schedule. Set it back to{' '}
                            <code className="font-mono">true</code> to resume.
                        </p>
                        <CodeBlock code="SIGNAL_ENABLED=false" />
                        <p className="text-muted-foreground">If the config is cached, rebuild it and restart the queue workers:</p>
                        <CodeBlock code={'php artisan config:cache\nphp artisan queue:restart'} />
                    </Step>
                    <Step n={2} title="Or switch off single collectors">
                        <CodeBlock
                            code={
                                'SIGNAL_CAPTURE_EXCEPTIONS=false\nSIGNAL_CAPTURE_LOGS=false\nSIGNAL_CAPTURE_REQUESTS=false\nSIGNAL_CAPTURE_JOBS=false'
                            }
                        />
                    </Step>
                    <Step n={3} title="Remove it">
                        <CodeBlock code="composer remove signal/laravel-agent" />
                        <p className="text-muted-foreground">
                            Then delete the <code className="font-mono">SIGNAL_*</code> lines from <code className="font-mono">.env</code>, the
                            repository entry from <code className="font-mono">composer.json</code>,{' '}
                            <code className="font-mono">config/signal-agent.php</code> if you published it, and the unsent spool in{' '}
                            <code className="font-mono">storage/framework/signal-agent</code>.
                        </p>
                    </Step>
                    <p className="text-muted-foreground">
                        Can't reach the app? Regenerate the token below. The dashboard then rejects the old agent, and the agent ignores the rejection
                        without affecting the app.
                    </p>
                </Panel>

                <ProjectSettings />
            </div>
        </AppLayout>
    );
}

function ProjectSettings() {
    const project = usePage<SharedData>().props.currentProject!;
    const params = { project: project.slug };
    const { data, setData, patch, processing, errors, recentlySuccessful } = useForm({ name: project.name, environment: project.environment });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        patch(route('projects.update', params), { preserveScroll: true });
    };

    return (
        <Panel title="Project" bodyClassName="flex flex-col gap-6 p-4">
            <form onSubmit={submit} className="flex flex-wrap items-end gap-4">
                <div className="grid min-w-48 flex-1 gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                    <InputError message={errors.name} />
                </div>
                <div className="grid min-w-48 flex-1 gap-2">
                    <Label htmlFor="environment">Environment</Label>
                    <Input id="environment" value={data.environment} onChange={(e) => setData('environment', e.target.value)} required />
                    <InputError message={errors.environment} />
                </div>
                <Button type="submit" variant="outline" disabled={processing}>
                    {recentlySuccessful ? 'Saved' : 'Save'}
                </Button>
            </form>

            <div className="flex flex-wrap gap-3 border-t pt-5">
                <ConfirmButton
                    label="Regenerate token"
                    title="Regenerate the ingest token?"
                    description="Agents using the current token are rejected until you update their SIGNAL_TOKEN."
                    onConfirm={(callbacks) => router.post(route('projects.token', params), {}, callbacks)}
                />
                <ConfirmButton
                    label="Delete project"
                    destructive
                    title={`Delete ${project.name}?`}
                    description="All hosts, exceptions, logs, requests and job records of this project are deleted permanently."
                    onConfirm={(callbacks) => router.delete(route('projects.destroy', params), callbacks)}
                />
            </div>
        </Panel>
    );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-3">
            <span className="text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs">{n}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h3 className="font-medium">{title}</h3>
                {children}
            </div>
        </div>
    );
}

function CodeBlock({ code }: { code: string }) {
    return (
        <div className="bg-muted relative rounded-md border">
            <pre className="overflow-x-auto p-3 pr-12 font-mono text-xs leading-relaxed">{code}</pre>
            <CopyButton value={code} className="absolute top-1.5 right-1.5" />
        </div>
    );
}

function CopyField({ value }: { value: string }) {
    return (
        <div className="bg-background flex items-center gap-2 rounded-md border p-1 pl-3">
            <code className="min-w-0 flex-1 truncate font-mono text-sm">{value}</code>
            <CopyButton value={value} />
        </div>
    );
}

function CopyButton({ value, className }: { value: string; className?: string }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        if (await copyText(value)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };

    return (
        <Button type="button" variant="ghost" size={copied ? 'sm' : 'icon'} onClick={copy} className={className} aria-label="Copy to clipboard">
            {copied ? (
                <>
                    <CheckIcon className="text-signal-accent" />
                    <span className="text-signal-accent text-xs">Copied</span>
                </>
            ) : (
                <CopyIcon />
            )}
        </Button>
    );
}

/**
 * The Clipboard API only exists on HTTPS and localhost, so plain-http hosts
 * like *.test fall back to a hidden textarea and execCommand.
 */
async function copyText(value: string): Promise<boolean> {
    if (window.isSecureContext && navigator.clipboard) {
        try {
            await navigator.clipboard.writeText(value);

            return true;
        } catch {
            // Fall through to the legacy path...
        }
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        textarea.remove();
    }
}

function ConfirmButton({
    label,
    title,
    description,
    destructive = false,
    onConfirm,
}: {
    label: string;
    title: string;
    description: string;
    destructive?: boolean;
    onConfirm: (callbacks: { onStart: () => void; onFinish: () => void }) => void;
}) {
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    // The visit may land back on this page, so close the dialog ourselves once it finishes...
    const confirm = () =>
        onConfirm({
            onStart: () => setProcessing(true),
            onFinish: () => {
                setProcessing(false);
                setOpen(false);
            },
        });

    return (
        <Dialog open={open} onOpenChange={(value) => !processing && setOpen(value)}>
            <DialogTrigger asChild>
                <Button variant={destructive ? 'destructive' : 'outline'}>{label}</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost" disabled={processing}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button variant={destructive ? 'destructive' : 'default'} onClick={confirm} disabled={processing}>
                        {processing && <CircleNotchIcon className="animate-spin" />}
                        {label}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
