import { cn } from '@/lib/utils';
import { type Period } from '@/types';
import { router, usePage } from '@inertiajs/react';

/**
 * Segmented control that reloads the page for another time window.
 */
export function PeriodPicker({ period }: { period: Period }) {
    const { url } = usePage();
    const path = url.split('?')[0];

    const select = (key: string) => {
        router.get(path, { period: key }, { preserveScroll: true, preserveState: true, replace: true });
    };

    return (
        <div role="group" aria-label="Time period" className="flex overflow-hidden rounded-md border">
            {period.options.map((key) => (
                <button
                    key={key}
                    type="button"
                    aria-pressed={key === period.key}
                    onClick={() => select(key)}
                    className={cn(
                        'h-8 border-r px-3 font-mono text-xs last:border-r-0',
                        key === period.key ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {key}
                </button>
            ))}
        </div>
    );
}
