import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Bucket } from '@/types';

interface StackedBarsProps {
    buckets: Bucket[];
    /** Tailwind background classes, one per series, bottom to top. */
    colors: string[];
    labels: string[];
    /** Fixed scale maximum (e.g. 100 for percentages); defaults to the tallest bar. */
    max?: number;
    height?: number;
    className?: string;
}

/**
 * Thin vertical bars, one per time bucket, each split into stacked series.
 */
export function StackedBars({ buckets, colors, labels, max, height = 88, className }: StackedBarsProps) {
    const totals = buckets.map((b) => b.values.reduce((sum, v) => sum + v, 0));
    const scale = max ?? Math.max(1, ...totals);
    const start = buckets[0]?.at;
    const end = buckets[buckets.length - 1]?.at;

    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <div
                className="border-border flex items-end gap-[2px] border-b"
                style={{ height }}
                role="img"
                aria-label={`${labels.join(', ')} over time`}
            >
                {buckets.map((bucket, i) => {
                    const total = totals[i];
                    const title = [formatDateTime(bucket.at), ...labels.map((label, s) => `${label}: ${bucket.values[s]}`)].join('\n');

                    return (
                        <div key={bucket.at} className="group flex h-full max-w-1.5 flex-1 flex-col justify-end" title={title}>
                            <div
                                className="flex flex-col-reverse overflow-hidden rounded-t-[1px] transition-opacity group-hover:opacity-80"
                                style={{ height: total > 0 ? `${Math.max(2, (total / scale) * 100)}%` : 1 }}
                            >
                                {total === 0 ? (
                                    <div className="bg-signal-track h-px" />
                                ) : (
                                    bucket.values.map((value, s) =>
                                        value > 0 ? (
                                            <div key={s} className={colors[s]} style={{ flexGrow: value, flexBasis: 0, minHeight: 1 }} />
                                        ) : null,
                                    )
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {start && end && (
                <div className="text-muted-foreground flex justify-between font-mono text-[11px]">
                    <span>{formatDateTime(start)}</span>
                    <span>now</span>
                </div>
            )}
        </div>
    );
}
