# Signal agent for Laravel

Reports a Laravel app's server and runtime to a self-hosted Signal dashboard:

- **Server**: CPU, RAM, disk, load and uptime (Linux, read from `/proc`)
- **Stack**: OS, kernel, PHP, Laravel, Composer, Node, database server (MySQL, MariaDB, PostgreSQL) and web server (Apache, nginx) versions
- **SSL**: expiry date and issuer of the certificate served at `APP_URL`
- **Exceptions**: class, message, stack trace, a source snippet and request/job/command context
- **Logs**: everything at or above `SIGNAL_LOG_LEVEL`
- **Requests**: method, route, status and duration
- **Jobs**: processed / released / failed, with duration

Supports Laravel 10 to 13 on PHP 8.1+.

## Install

Until the package is published, point Composer at this folder (path) or at the repository (VCS):

```json
"repositories": [
    { "type": "path", "url": "../nightwatch/packages/signal-agent" }
]
```

```bash
composer require signal/laravel-agent:@dev
```

Create a project in the dashboard, then add its URL and token to the app's `.env`:

```dotenv
SIGNAL_URL=https://signal.example.com
SIGNAL_TOKEN=sig_...
```

Make sure the scheduler runs, because it sends the per-minute report:

```cron
* * * * * cd /path-to-your-app && php artisan schedule:run >> /dev/null 2>&1
```

Then check the connection:

```bash
php artisan signal:test
```

## Pause or remove

Pause the agent without uninstalling it. Nothing is captured or sent, and `signal:report` leaves the schedule:

```dotenv
SIGNAL_ENABLED=false
```

If the config is cached, run `php artisan config:cache` and `php artisan queue:restart` afterwards. Set it back to `true` to resume. Clearing `SIGNAL_URL` or `SIGNAL_TOKEN` has the same effect.

To stop only part of it, set `SIGNAL_CAPTURE_EXCEPTIONS`, `SIGNAL_CAPTURE_LOGS`, `SIGNAL_CAPTURE_REQUESTS` or `SIGNAL_CAPTURE_JOBS` to `false`.

To remove it:

```bash
composer remove signal/laravel-agent
```

Then delete the `SIGNAL_*` lines from `.env`, the repository entry from `composer.json`, `config/signal-agent.php` if you published it, and the unsent spool in `storage/framework/signal-agent`.

If you can't reach the app, regenerate the project's token in the dashboard. The dashboard then rejects the old agent, which ignores the rejection without affecting the app.

## How data is delivered

- **Exceptions** are posted to the dashboard when the request, job or command that raised them finishes.
- **Requests, jobs and logs** are appended to a spool file (`storage/framework/signal-agent`). `signal:report` ships the spool every minute along with a fresh metrics sample.
- If the dashboard can't be reached, data stays in the spool and is retried on the next run. The spool stops growing at 20 MB.
- Every failure inside the agent is swallowed. The agent never throws into your app.

## Configuration

Publish the config file to change more than the `.env` options:

```bash
php artisan vendor:publish --tag=signal-agent-config
```

| Variable | Default | |
| --- | --- | --- |
| `SIGNAL_ENABLED` | `true` | Turn the agent off without uninstalling it |
| `SIGNAL_HOSTNAME` | machine hostname | Name this server reports under |
| `SIGNAL_LOG_LEVEL` | `info` | Lowest log level sent |
| `SIGNAL_REQUEST_SAMPLE_RATE` | `1` | Fraction of requests recorded |
| `SIGNAL_CAPTURE_EXCEPTIONS` / `_LOGS` / `_REQUESTS` / `_JOBS` | `true` | Switch individual collectors off |
| `SIGNAL_DISK_PATH` | `/` | Filesystem reported as "disk" |
| `SIGNAL_COMPOSER_BINARY` | `composer` | Used to detect the Composer version, or set it empty to skip |
| `SIGNAL_NODE_BINARY` | `node` | Used to detect the Node version, or set it empty to skip |
| `SIGNAL_CERTIFICATE_URL` | `APP_URL` | https URL whose certificate expiry is reported. Nothing is reported for http |
| `SIGNAL_SCHEDULE` | `true` | Register `signal:report` in the scheduler automatically |

Composer is detected by running `composer --version` as the scheduler's user. If Composer isn't on that user's `PATH`, set `SIGNAL_COMPOSER_BINARY` to its full path.

The web server is taken from `SERVER_SOFTWARE` of the app's web requests, so it shows up after the first page is served. Until then the agent asks `nginx`, `apache2` and `httpd` for their version (`web_server_binaries` in the config). Servers that hide their version (`ServerTokens Prod`, `server_tokens off`) are reported by name only.

The certificate is read from the server itself once an hour, so it works for apps the dashboard can't reach.
