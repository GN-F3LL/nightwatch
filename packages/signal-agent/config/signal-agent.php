<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Connection
    |--------------------------------------------------------------------------
    |
    | The dashboard's base URL and this project's ingest token, shown once on
    | the project's Setup page. The agent stays idle until both are set.
    |
    */

    'enabled' => env('SIGNAL_ENABLED', true),

    'url' => env('SIGNAL_URL'),

    'token' => env('SIGNAL_TOKEN'),

    'timeout' => (float) env('SIGNAL_TIMEOUT', 3),

    /*
    |--------------------------------------------------------------------------
    | Host
    |--------------------------------------------------------------------------
    |
    | Name this server reports under. Defaults to the machine's hostname, so
    | every server running the app shows up as its own host.
    |
    */

    'hostname' => env('SIGNAL_HOSTNAME'),

    // Filesystem whose usage is reported as "disk"...
    'disk_path' => env('SIGNAL_DISK_PATH', '/'),

    // Binaries used to detect versions; set to null to skip...
    'composer_binary' => env('SIGNAL_COMPOSER_BINARY', 'composer'),
    'node_binary' => env('SIGNAL_NODE_BINARY', 'node'),

    // https URL whose TLS certificate expiry is reported; defaults to APP_URL...
    'certificate_url' => env('SIGNAL_CERTIFICATE_URL'),

    // Asked for their version until a web request reports the server it ran under (cron's PATH often lacks /usr/sbin)...
    'web_server_binaries' => ['nginx', 'apache2', 'httpd', '/usr/sbin/nginx', '/usr/sbin/apache2', '/usr/sbin/httpd'],

    /*
    |--------------------------------------------------------------------------
    | Capture
    |--------------------------------------------------------------------------
    */

    'capture' => [
        'exceptions' => env('SIGNAL_CAPTURE_EXCEPTIONS', true),
        'logs' => env('SIGNAL_CAPTURE_LOGS', true),
        'requests' => env('SIGNAL_CAPTURE_REQUESTS', true),
        'jobs' => env('SIGNAL_CAPTURE_JOBS', true),
    ],

    // Lowest log level that is sent (debug, info, notice, warning, error, ...)...
    'log_level' => env('SIGNAL_LOG_LEVEL', 'info'),

    // Fraction of requests recorded, between 0 and 1...
    'request_sample_rate' => (float) env('SIGNAL_REQUEST_SAMPLE_RATE', 1),

    // Request paths that are never recorded ($request->is() patterns)...
    'ignore_paths' => [
        'up',
        'horizon/*',
        'telescope/*',
        'pulse',
        '_debugbar/*',
    ],

    // Exception classes that are never sent...
    'ignore_exceptions' => [
        //
    ],

    /*
    |--------------------------------------------------------------------------
    | Delivery
    |--------------------------------------------------------------------------
    |
    | Requests, jobs and logs are spooled to a local file and shipped by the
    | `signal:report` command every minute. Exceptions are sent right away.
    | The spool stops growing at max_spool_bytes while the dashboard is
    | unreachable.
    |
    */

    'schedule' => env('SIGNAL_SCHEDULE', true),

    'spool_path' => storage_path('framework/signal-agent'),

    'max_spool_bytes' => 20 * 1024 * 1024,

];
