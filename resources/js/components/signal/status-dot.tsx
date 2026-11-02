import { cn } from '@/lib/utils';

/**
 * Online / offline indicator for a host or project.
 */
export function StatusDot({ online, className }: { online: boolean; className?: string }) {
    return (
        <span
            role="img"
            aria-label={online ? 'Online' : 'Offline'}
            className={cn('inline-block size-2 shrink-0 rounded-full', online ? 'bg-signal-online' : 'bg-muted-foreground/50', className)}
        />
    );
}
