import { cn } from '@/lib/utils';
import { type Severity } from '@/types';

const styles: Record<Severity, string> = {
    critical: 'bg-signal-error text-[#2a0a0a]',
    high: 'bg-signal-error/15 text-signal-error',
    medium: 'bg-signal-warn/15 text-signal-warn',
    low: 'bg-muted text-muted-foreground',
    unknown: 'bg-muted text-muted-foreground',
};

/**
 * CVSS / advisory severity as a small coloured tag.
 */
export function SeverityBadge({ severity, score, className }: { severity: Severity; score?: number | null; className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase',
                styles[severity],
                className,
            )}
        >
            {severity === 'unknown' ? 'unrated' : severity}
            {score != null && <span className="font-normal opacity-80">{score.toFixed(1)}</span>}
        </span>
    );
}
