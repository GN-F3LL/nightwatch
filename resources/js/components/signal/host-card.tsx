import { Meter } from '@/components/signal/meter';
import { StatusDot } from '@/components/signal/status-dot';
import { VersionBadge } from '@/components/signal/version-badge';
import { formatBytes, formatUptime, timeAgo } from '@/lib/format';
import { type Host } from '@/types';

/**
 * One server: resources, load and its stack versions.
 */
export function HostCard({ host }: { host: Host }) {
    return (
        <div className="flex min-w-0 flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                    <StatusDot online={host.online} />
                    <span className="truncate font-mono text-[13px] font-semibold">{host.hostname}</span>
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                    {host.online ? `up ${formatUptime(host.uptime_seconds)}` : `offline · ${timeAgo(host.last_seen_at)}`}
                </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
                <Meter label="CPU" value={host.cpu_percent} detail={host.cpu_cores ? `${host.cpu_cores} cores` : undefined} />
                <Meter label="RAM" value={host.memory_percent} detail={`${formatBytes(host.memory_used)} of ${formatBytes(host.memory_total)}`} />
                <Meter label="DISK" value={host.disk_percent} detail={`${formatBytes(host.disk_used)} of ${formatBytes(host.disk_total)}`} />
            </div>
            <div className="flex flex-wrap gap-1.5">
                {host.os && <span className="text-foreground/80 rounded border px-1.5 py-0.5 font-mono text-[11px]">{host.os}</span>}
                <VersionBadge label="PHP" version={host.versions.php} />
                <VersionBadge label="Laravel" version={host.versions.laravel} />
                <VersionBadge label="Composer" version={host.versions.composer} />
                <VersionBadge label="Node" version={host.versions.node} />
                <VersionBadge version={host.versions.database} />
                <VersionBadge version={host.versions.web_server} />
            </div>
            {host.load[0] !== null && (
                <span className="text-muted-foreground font-mono text-[11px]">
                    load {host.load.map((l) => (l === null ? '—' : l.toFixed(2))).join(' · ')}
                </span>
            )}
        </div>
    );
}
