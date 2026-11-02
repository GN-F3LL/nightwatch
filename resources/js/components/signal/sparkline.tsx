import { cn } from '@/lib/utils';

interface SparklineProps {
    values: number[];
    className?: string;
    width?: number;
    height?: number;
    label?: string;
}

/**
 * Tiny inline trend line. Inherits its colour from `currentColor`.
 */
export function Sparkline({ values, className, width = 72, height = 20, label }: SparklineProps) {
    if (values.length < 2) {
        return <span className={cn('inline-block', className)} style={{ width, height }} />;
    }

    const max = Math.max(1, ...values);
    const points = values
        .map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 1 - (v / max) * (height - 2)).toFixed(1)}`)
        .join(' ');

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            fill="none"
            className={cn('shrink-0', className)}
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
        >
            <polyline points={points} stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
        </svg>
    );
}
