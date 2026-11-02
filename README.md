# Signal

Self-hosted monitoring for Laravel apps: servers (CPU, RAM, disk, load), stack versions (OS, PHP, Laravel, Composer), exceptions, logs, requests and queued jobs, in one dashboard.

- **Dashboard**: this Laravel 12 + Inertia + React app.
- **Agent**: [`packages/signal-agent`](packages/signal-agent). A Composer package you install in each monitored app.

## Dashboard setup

```bash
composer install
npm install && npm run build
cp .env.example .env && php artisan key:generate
# set DB_* in .env (MySQL), then:
php artisan migrate
```

Open the app and register. Only the first account can sign up; set `SIGNAL_OPEN_REGISTRATION=true` to allow more.

Run the scheduler so old telemetry is pruned daily (`signal:prune`):

```cron
* * * * * cd /path-to-signal && php artisan schedule:run >> /dev/null 2>&1
```

| Variable | Default | |
| --- | --- | --- |
| `SIGNAL_RETENTION_DAYS` | `14` | Days of metrics, requests, jobs, logs and exception occurrences kept |
| `SIGNAL_OFFLINE_AFTER` | `180` | Seconds without a report before a host is shown as offline |
| `SIGNAL_OPEN_REGISTRATION` | `false` | Allow sign-up after the first account |

| `SIGNAL_NVD_API_KEY` | none | Optional [NVD API key](https://nvd.nist.gov/developers/request-an-api-key) for faster vulnerability checks |
| `SIGNAL_VULNERABILITY_REFRESH_HOURS` | `24` | How often each version is checked again |

End-of-life version prefixes for PHP and Laravel are listed in `config/signal.php`. Update them as releases age.

## Vulnerability check

**Vulnerability check** on the Projects page lists every version your hosts run with its known CVEs, its support status and the version to update to. Sources:

- [OSV.dev](https://osv.dev) for Laravel and Composer
- the [NVD](https://nvd.nist.gov) for PHP, Node.js, MySQL, MariaDB, PostgreSQL, nginx and Apache, matched by CPE
- [endoflife.date](https://endoflife.date) for the newest patch of each release line and its end of life

The scheduler runs `signal:scan-vulnerabilities` every hour. A new version is checked within the hour, and each version is checked again after a day. **Check now** on the page checks everything again right away. Without an API key the NVD allows 5 requests per 30 seconds, so a full check takes about a minute.

Packages from Linux distributions often carry backported fixes without a new version number, so CVEs for OS-packaged PHP, databases or web servers can be false positives. Confirm them against your distribution's security tracker.

## Connecting an app

1. In the dashboard, click **New project**. The token is shown once on the Setup page.
2. In the app: `composer require signal/laravel-agent:@dev`, then set `SIGNAL_URL` and `SIGNAL_TOKEN` in its `.env`.
3. Make sure the app's scheduler runs, then run `php artisan signal:test`.

See the [agent README](packages/signal-agent/README.md) for options.

## Ingest API

`POST /api/ingest` with `Authorization: Bearer <project token>`. The body holds `host` (required, with `hostname`) and optional lists: `metrics`, `exceptions`, `logs`, `requests`, `jobs`, at most 1000 items each. See `app/Http/Controllers/Api/IngestController.php` for the item fields.

## Tests

```bash
php artisan test
```

Tests run against in-memory SQLite (see `phpunit.xml`). The app itself uses MySQL.
