import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { type ReactNode } from 'react';

interface PanelProps {
    title: ReactNode;
    action?: { label: string; href: string };
    aside?: ReactNode;
    className?: string;
    bodyClassName?: string;
    children: ReactNode;
}

/**
 * A bordered section with a small header row.
 */
export function Panel({ title, action, aside, className, bodyClassName, children }: PanelProps) {
    return (
        <section className={cn('bg-card min-w-0 rounded-lg border', className)}>
            <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <h2 className="text-foreground/80 text-[13px] font-semibold">{title}</h2>
                <div className="flex items-center gap-3">
                    {aside}
                    {action && (
                        <Link href={action.href} className="text-primary text-xs hover:underline">
                            {action.label}
                        </Link>
                    )}
                </div>
            </header>
            <div className={bodyClassName}>{children}</div>
        </section>
    );
}

export function EmptyRow({ children }: { children: ReactNode }) {
    return <p className="text-muted-foreground px-4 py-8 text-center text-sm">{children}</p>;
}
