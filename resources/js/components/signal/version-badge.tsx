import { cn } from '@/lib/utils';
import { type Version } from '@/types';

const styles = {
    current: 'text-foreground/80 border-border',
    behind: 'text-signal-warn border-signal-warn/40',
    eol: 'text-signal-error border-signal-error/40',
};

const hints = {
    current: undefined,
    behind: 'Newer version running elsewhere in the fleet',
    eol: 'End of life: no longer receives security fixes',
};

/**
 * A version chip coloured by how current it is.
 */
export function VersionBadge({ label, version, className }: { label?: string; version: Version | null; className?: string }) {
    if (!version) {
        return null;
    }

    return (
        <span
            title={hints[version.state]}
            className={cn(
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap',
                styles[version.state],
                className,
            )}
        >
            {(version.name ?? label) && <span className="text-muted-foreground">{version.name ?? label}</span>}
            {version.value}
            {version.state === 'eol' && <span className="font-semibold">EOL</span>}
        </span>
    );
}

/**
 * Plain version text for table cells.
 */
export function VersionText({ version }: { version: Version | null }) {
    if (!version) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <span
            title={hints[version.state]}
            className={cn('font-mono text-xs', version.state === 'current' ? '' : styles[version.state].split(' ')[0])}
        >
            {version.name && <span className="text-muted-foreground">{version.name} </span>}
            {version.value}
            {version.state === 'eol' && <span className="bg-signal-error/15 ml-1.5 rounded px-1 text-[10px] font-semibold">EOL</span>}
            {version.state === 'behind' && <span className="ml-1 text-[10px]">↑</span>}
        </span>
    );
}
