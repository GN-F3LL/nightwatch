import { StackedBars } from '@/components/signal/stacked-bars';
import { cn } from '@/lib/utils';
import { type Bucket } from '@/types';
import { Link } from '@inertiajs/react';

export interface Series {
    label: string;
    value: string;
    color: string;
}

interface MetricPanelProps {
    title: string;
    total: string;
    totalClassName?: string;
    series: Series[];
    buckets: Bucket[];
    href?: string;
    max?: number;
    height?: number;
}

/**
 * Headline number, a legend with per-series totals and a stacked bar timeline.
 */
export function MetricPanel({ title, total, totalClassName, series, buckets, href, max, height }: MetricPanelProps) {
    return (
        <section className="bg-card flex min-w-0 flex-col gap-3 p-4">
            <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-foreground/80 text-[13px] font-semibold">{title}</h2>
                {href && (
                    <Link href={href} className="text-primary text-xs hover:underline">
                        View
                    </Link>
                )}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className={cn('font-mono text-2xl font-semibold tracking-tight', totalClassName)}>{total}</span>
                {series.map((s) => (
                    <span key={s.label} className="text-foreground/80 inline-flex items-center gap-1.5 font-mono text-xs">
                        <span className={`size-2 rounded-[2px] ${s.color}`} />
                        {s.label} {s.value}
                    </span>
                ))}
            </div>
            <StackedBars buckets={buckets} colors={series.map((s) => s.color)} labels={series.map((s) => s.label)} max={max} height={height} />
        </section>
    );
}
