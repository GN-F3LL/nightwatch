import { formatDuration, formatInteger } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type RouteStat } from '@/types';

const methodColors: Record<string, string> = {
    GET: 'text-signal-accent',
    POST: 'text-signal-warn',
    DELETE: 'text-signal-error',
};

/**
 * Route performance table: calls, errors, average and p95 duration.
 */
export function RoutesTable({ routes, detailed = false }: { routes: RouteStat[]; detailed?: boolean }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                    <tr className="text-muted-foreground text-left text-[11px] tracking-wide uppercase">
                        <th className="px-4 py-2.5 font-medium">Route</th>
                        <th className="px-3 py-2.5 text-right font-medium">Calls</th>
                        {detailed && <th className="px-3 py-2.5 text-right font-medium">4xx</th>}
                        <th className="px-3 py-2.5 text-right font-medium">5xx</th>
                        <th className="px-3 py-2.5 text-right font-medium">Avg</th>
                        <th className="px-4 py-2.5 text-right font-medium">P95</th>
                        {detailed && <th className="px-4 py-2.5 text-right font-medium">Max</th>}
                    </tr>
                </thead>
                <tbody className="font-mono text-xs">
                    {routes.map((r) => (
                        <tr key={`${r.method} ${r.route}`} className="border-t">
                            <td className="px-4 py-2.5 whitespace-nowrap">
                                <span className={cn('inline-block w-14 font-semibold', methodColors[r.method] ?? 'text-chart-4')}>{r.method}</span>
                                {r.route}
                            </td>
                            <td className="px-3 py-2.5 text-right">{formatInteger(r.calls)}</td>
                            {detailed && (
                                <td className={cn('px-3 py-2.5 text-right', r.client_errors > 0 ? 'text-signal-warn' : 'text-muted-foreground')}>
                                    {formatInteger(r.client_errors)}
                                </td>
                            )}
                            <td className={cn('px-3 py-2.5 text-right', r.server_errors > 0 ? 'text-signal-error' : 'text-muted-foreground')}>
                                {formatInteger(r.server_errors)}
                            </td>
                            <td className="text-foreground/80 px-3 py-2.5 text-right">{formatDuration(r.avg_ms)}</td>
                            <td className={cn('px-4 py-2.5 text-right font-semibold', (r.p95_ms ?? 0) >= 1000 ? 'text-signal-warn' : '')}>
                                {formatDuration(r.p95_ms)}
                            </td>
                            {detailed && <td className="text-muted-foreground px-4 py-2.5 text-right">{formatDuration(r.max_ms)}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
