const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('en');

export function formatCompact(value: number): string {
    return value >= 10_000 ? compact.format(value) : integer.format(value);
}

export function formatInteger(value: number): string {
    return integer.format(value);
}

export function formatDuration(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) {
        return '—';
    }

    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}

export function formatBytes(bytes: number | null | undefined): string {
    if (!bytes) {
        return '—';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);

    return `${(bytes / 1024 ** exponent).toFixed(exponent >= 3 ? 1 : 0)} ${units[exponent]}`;
}

export function formatPercent(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : `${Math.round(value)}%`;
}

export function formatUptime(seconds: number | null | undefined): string {
    if (!seconds) {
        return '—';
    }

    const days = Math.floor(seconds / 86400);

    return days > 0 ? `${days}d` : `${Math.floor(seconds / 3600)}h`;
}

export function timeAgo(iso: string | null | undefined): string {
    if (!iso) {
        return 'never';
    }

    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

    return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Text colour for a utilisation percentage: neutral below 70, amber below 80, red from 80.
 */
export function usageTone(value: number | null | undefined): string {
    if (value === null || value === undefined) return 'text-muted-foreground';
    if (value >= 80) return 'text-signal-error';
    if (value >= 70) return 'text-signal-warn';

    return 'text-foreground';
}

export function usageFill(value: number | null | undefined): string {
    if (value === null || value === undefined) return 'bg-signal-ok';
    if (value >= 80) return 'bg-signal-error';
    if (value >= 70) return 'bg-signal-warn';

    return 'bg-signal-accent';
}
