import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Certificate } from '@/types';

/**
 * Days until the app's TLS certificate expires: amber from 21 days, red from 7 and once expired.
 */
export function CertificateBadge({ certificate, className }: { certificate: Certificate | null; className?: string }) {
    if (!certificate) {
        return null;
    }

    const days = certificate.days_left;
    const tone =
        days <= 7
            ? 'text-signal-error border-signal-error/40'
            : days <= 21
              ? 'text-signal-warn border-signal-warn/40'
              : 'text-foreground/80 border-border';
    const label = days < 0 ? 'expired' : days === 0 ? 'expires today' : `${days}d left`;

    return (
        <span
            title={[certificate.host, certificate.issuer && `issued by ${certificate.issuer}`, `expires ${formatDate(certificate.expires_at)}`]
                .filter(Boolean)
                .join(' · ')}
            className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap', tone, className)}
        >
            <span className="text-muted-foreground">SSL</span>
            {label}
        </span>
    );
}
