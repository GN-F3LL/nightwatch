<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Retention
    |--------------------------------------------------------------------------
    |
    | Telemetry older than this many days is removed by `signal:prune`, which
    | is scheduled daily. Exception groups are kept; only their individual
    | occurrences are pruned.
    |
    */

    'retention_days' => (int) env('SIGNAL_RETENTION_DAYS', 14),

    /*
    |--------------------------------------------------------------------------
    | Offline Threshold
    |--------------------------------------------------------------------------
    |
    | Agents report every minute. A host that has not reported for this many
    | seconds is shown as offline.
    |
    */

    'offline_after' => (int) env('SIGNAL_OFFLINE_AFTER', 180),

    /*
    |--------------------------------------------------------------------------
    | End-Of-Life Versions
    |--------------------------------------------------------------------------
    |
    | Version prefixes that no longer receive security fixes. Hosts running a
    | matching version are flagged as EOL in the fleet view. Adjust these as
    | new releases ship.
    |
    */

    'eol' => [
        'php' => ['5.', '7.', '8.0.', '8.1.'],
        'laravel' => ['5.', '6.', '7.', '8.', '9.', '10.', '11.'],
        'node' => [...array_map(fn ($major) => "{$major}.", range(0, 21)), '23.', '25.'],
        'mysql' => ['5.', '8.0.', '8.1.', '8.2.', '8.3.'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Vulnerability Check
    |--------------------------------------------------------------------------
    |
    | Versions reported by hosts are looked up on OSV.dev, the NVD and
    | endoflife.date. Each version is checked again after refresh_hours. The
    | NVD allows 5 requests per 30 seconds without an API key and 50 with
    | one (free at https://nvd.nist.gov/developers/request-an-api-key).
    |
    */

    'vulnerabilities' => [
        'refresh_hours' => (int) env('SIGNAL_VULNERABILITY_REFRESH_HOURS', 24),
        'nvd_api_key' => env('SIGNAL_NVD_API_KEY'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Ingest Limits
    |--------------------------------------------------------------------------
    |
    | The maximum number of items of each kind accepted in one ingest batch.
    |
    */

    'ingest' => [
        'max_items' => (int) env('SIGNAL_INGEST_MAX_ITEMS', 1000),
    ],

    /*
    |--------------------------------------------------------------------------
    | Registration
    |--------------------------------------------------------------------------
    |
    | Sign-up closes once the first account exists. Set this to true to let
    | anyone who can reach the dashboard create an account.
    |
    */

    'open_registration' => (bool) env('SIGNAL_OPEN_REGISTRATION', false),

];
