import { formatPercent, usageFill, usageTone } from '@/lib/format';
import { cn } from '@/lib/utils';

interface MeterProps {
    label: string;
    value: number | null;
    detail?: string;
    className?: string;
}

/**
 * Compact utilisation bar for CPU / RAM / disk.
 */
export function Meter({ label, value, detail, className }: MeterProps) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-1.5', className)} title={detail}>
            <span className="flex justify-between gap-2 font-mono text-[11px]">
                <span className="text-muted-foreground">{label}</span>
                <span className={usageTone(value)}>{formatPercent(value)}</span>
            </span>
            <div className="bg-signal-track h-1 overflow-hidden rounded-full">
                <div className={cn('h-full rounded-full', usageFill(value))} style={{ width: `${Math.min(100, value ?? 0)}%` }} />
            </div>
        </div>
    );
}
