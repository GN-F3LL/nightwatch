export interface Period {
    key: string;
    start: string;
    end: string;
    options: string[];
}

export interface Bucket {
    at: string;
    values: number[];
}

export interface Timeline {
    total: number;
    counts: Record<string, number>;
    buckets: Bucket[];
}

export interface ResourceBucket {
    at: string;
    cpu: number | null;
    memory: number | null;
}

export type VersionState = 'current' | 'behind' | 'eol';

export interface Version {
    /** Product name where the component varies (MySQL, MariaDB, nginx, Apache). */
    name?: string | null;
    value: string;
    state: VersionState;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export interface Advisory {
    id: string;
    reference: string;
    summary: string;
    severity: Severity;
    score: number | null;
    fixed_in: string | null;
    url: string;
    published_at: string | null;
}

export interface ComponentReport {
    key: string;
    component: string;
    name: string;
    version: string;
    status: 'vulnerable' | 'eol' | 'outdated' | 'pending' | 'ok';
    worst: Severity | null;
    advisories: Advisory[];
    latest_patch: string | null;
    latest_release: string | null;
    eol: boolean | null;
    eol_date: string | null;
    recommendation: string | null;
    error: string | null;
    checked_at: string | null;
    hosts: { hostname: string; project: { name: string; slug: string } }[];
}

/** What one project has to fix, across the component versions its hosts run. */
export interface ProjectSecurity {
    name: string;
    slug: string;
    to_update: number;
    outdated: number;
    eol: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    components: number;
}

export interface SecuritySummary extends Record<Severity, number> {
    vulnerable: number;
    eol: number;
    outdated: number;
    pending: number;
    total: number;
    checked_at: string | null;
    running: boolean;
}

export interface Certificate {
    host: string | null;
    issuer: string | null;
    expires_at: string;
    days_left: number;
}

export interface Host {
    id: number;
    hostname: string;
    online: boolean;
    last_seen_at: string | null;
    os: string | null;
    kernel: string | null;
    cpu_cores: number | null;
    cpu_percent: number | null;
    memory_percent: number | null;
    memory_used: number | null;
    memory_total: number | null;
    disk_percent: number | null;
    disk_used: number | null;
    disk_total: number | null;
    load: (number | null)[];
    uptime_seconds: number | null;
    versions: {
        php: Version | null;
        laravel: Version | null;
        composer: Version | null;
        node: Version | null;
        database: Version | null;
        web_server: Version | null;
    };
}

export interface RouteStat {
    method: string;
    route: string;
    calls: number;
    client_errors: number;
    server_errors: number;
    avg_ms: number;
    max_ms: number;
    p95_ms: number | null;
}

export interface JobStat {
    name: string;
    queue: string | null;
    attempts: number;
    processed: number;
    released: number;
    failed: number;
    avg_ms: number;
    max_ms: number;
}

export type ExceptionStatus = 'unresolved' | 'resolved' | 'ignored';

export interface ExceptionSummary {
    id: number;
    class: string;
    message: string;
    status: ExceptionStatus;
    events: number;
    last_seen_at: string;
}

export interface ExceptionGroup {
    id: number;
    class: string;
    message: string;
    file: string | null;
    line: number | null;
    status: ExceptionStatus;
    occurrences: number;
    first_seen_at: string;
    last_seen_at: string;
    resolved_at: string | null;
    regressed_at: string | null;
    trend: number[];
}

export interface StackFrame {
    file?: string | null;
    line?: number | null;
    class?: string | null;
    function?: string | null;
    app?: boolean;
}

export interface CodeSnippet {
    file: string;
    line: number;
    start: number;
    lines: string[];
}

export interface Paginated<T> {
    data: T[];
    current_page?: number;
    last_page?: number;
    total?: number;
    next_page_url: string | null;
    prev_page_url: string | null;
}
