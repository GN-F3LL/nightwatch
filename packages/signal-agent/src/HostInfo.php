<?php

namespace Signal\Agent;

use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use PDO;
use Throwable;

/**
 * Detects the server's identity, stack versions and resource usage.
 *
 * Resource figures come from /proc and are only available on Linux; elsewhere they are reported as null.
 */
class HostInfo
{
    public function __construct(protected Application $app)
    {
        //
    }

    /**
     * Cheap identity sent with every batch.
     *
     * @return array<string, mixed>
     */
    public function basic(): array
    {
        return [
            'hostname' => config('signal-agent.hostname') ?: (gethostname() ?: 'unknown'),
            'php_version' => PHP_VERSION,
            'laravel_version' => $this->app->version(),
        ];
    }

    /**
     * Full stack description, sent by `signal:report`.
     *
     * @return array<string, mixed>
     */
    public function stack(): array
    {
        [$osName, $osVersion] = $this->os();

        return $this->basic() + [
            'os_name' => $osName,
            'os_version' => $osVersion,
            'kernel' => php_uname('r'),
            'composer_version' => $this->binaryVersion(config('signal-agent.composer_binary'), '/(\d+\.\d+\.\d+(?:-[\w.]+)?)/'),
            'node_version' => $this->binaryVersion(config('signal-agent.node_binary'), '/v?(\d+\.\d+\.\d+)/'),
            'database_version' => $this->databaseVersion(),
            'web_server' => $this->webServer(),
            'cpu_cores' => $this->cpuCores(),
            'uptime_seconds' => $this->uptime(),
        ];
    }

    /**
     * Point-in-time resource usage. Takes about half a second to sample CPU.
     *
     * @return array<string, mixed>
     */
    public function metrics(): array
    {
        $memory = $this->memory();
        $disk = $this->disk();
        $load = function_exists('sys_getloadavg') ? sys_getloadavg() : false;

        return [
            'cpu_percent' => $this->cpuPercent(),
            'memory_used' => $memory[0],
            'memory_total' => $memory[1],
            'disk_used' => $disk[0],
            'disk_total' => $disk[1],
            'load' => $load ? array_map(fn ($l) => round($l, 2), $load) : null,
            'recorded_at' => now()->toIso8601ZuluString(),
        ];
    }

    protected function cpuPercent(): ?float
    {
        $first = $this->cpuTimes();

        if ($first === null) {
            return null;
        }

        usleep(500_000);
        $second = $this->cpuTimes();

        $total = array_sum($second) - array_sum($first);
        $idle = ($second[3] + ($second[4] ?? 0)) - ($first[3] + ($first[4] ?? 0));

        return $total > 0 ? round((1 - $idle / $total) * 100, 2) : null;
    }

    /**
     * Aggregate CPU jiffies from /proc/stat: user nice system idle iowait irq softirq steal.
     *
     * @return list<int>|null
     */
    protected function cpuTimes(): ?array
    {
        $line = @file('/proc/stat', FILE_IGNORE_NEW_LINES)[0] ?? null;

        if (! $line || ! str_starts_with($line, 'cpu ')) {
            return null;
        }

        return array_map('intval', array_slice(preg_split('/\s+/', trim($line)), 1, 8));
    }

    /**
     * @return array{0: int|null, 1: int|null} used and total bytes
     */
    protected function memory(): array
    {
        $info = @file_get_contents('/proc/meminfo');

        if (! $info || ! preg_match('/^MemTotal:\s+(\d+)/m', $info, $total)) {
            return [null, null];
        }

        $available = preg_match('/^MemAvailable:\s+(\d+)/m', $info, $m) ? (int) $m[1] : null;
        $totalBytes = (int) $total[1] * 1024;

        return [$available === null ? null : $totalBytes - $available * 1024, $totalBytes];
    }

    /**
     * @return array{0: int|null, 1: int|null} used and total bytes
     */
    protected function disk(): array
    {
        $path = config('signal-agent.disk_path') ?: '/';
        $total = @disk_total_space($path);
        $free = @disk_free_space($path);

        return $total ? [(int) ($total - $free), (int) $total] : [null, null];
    }

    protected function cpuCores(): ?int
    {
        $info = @file_get_contents('/proc/cpuinfo');

        if ($info) {
            return preg_match_all('/^processor\s*:/m', $info) ?: null;
        }

        return is_numeric($n = getenv('NUMBER_OF_PROCESSORS')) ? (int) $n : null;
    }

    protected function uptime(): ?int
    {
        $uptime = @file_get_contents('/proc/uptime');

        return $uptime ? (int) explode(' ', $uptime)[0] : null;
    }

    /**
     * @return array{0: string, 1: string|null}
     */
    protected function os(): array
    {
        $release = @parse_ini_file('/etc/os-release');

        if ($release && isset($release['NAME'])) {
            return [$release['NAME'], $release['VERSION_ID'] ?? null];
        }

        return [PHP_OS_FAMILY, php_uname('r')];
    }

    /**
     * Run `<binary> --version` and extract the version. Cached for an hour; null when unavailable.
     */
    protected function binaryVersion(?string $binary, string $pattern): ?string
    {
        if (! $binary) {
            return null;
        }

        return $this->remember("signal-agent:version:{$binary}", function () use ($binary, $pattern) {
            $result = Process::timeout(15)
                ->env(['COMPOSER_ALLOW_SUPERUSER' => '1', 'COMPOSER_NO_INTERACTION' => '1'])
                ->run([$binary, '--version', '--no-ansi']);

            // node rejects unknown flags; retry plain...
            if (! $result->successful()) {
                $result = Process::timeout(15)->run([$binary, '--version']);
            }

            return $result->successful() && preg_match($pattern, $result->output(), $m) ? $m[1] : null;
        });
    }

    protected function databaseVersion(): ?string
    {
        try {
            $connection = DB::connection();
            $version = $connection->getPdo()->getAttribute(PDO::ATTR_SERVER_VERSION);

            return $version ? $connection->getDriverName().' '.$version : null;
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * The TLS certificate served at the app's https URL. Checked at most once an hour.
     *
     * @return array{host: string, issuer: string|null, expires_at: string}|null
     */
    public function certificate(): ?array
    {
        $url = (string) (config('signal-agent.certificate_url') ?: config('app.url'));
        $host = parse_url($url, PHP_URL_HOST);

        if (parse_url($url, PHP_URL_SCHEME) !== 'https' || ! $host) {
            return null;
        }

        $port = parse_url($url, PHP_URL_PORT) ?: 443;

        // Cached as [] on failure, so an unreachable URL isn't retried every minute...
        return $this->remember("signal-agent:certificate:{$host}:{$port}", fn () => $this->readCertificate($host, $port) ?? []) ?: null;
    }

    /**
     * @return array{host: string, issuer: string|null, expires_at: string}|null
     */
    protected function readCertificate(string $host, int $port): ?array
    {
        // Read the certificate even when it is expired or self-signed: that is what we want to report...
        $context = stream_context_create(['ssl' => [
            'capture_peer_cert' => true,
            'verify_peer' => false,
            'verify_peer_name' => false,
            'peer_name' => $host,
            'SNI_enabled' => true,
        ]]);

        $client = @stream_socket_client("ssl://{$host}:{$port}", $errno, $error, 5, STREAM_CLIENT_CONNECT, $context);

        if (! $client) {
            return null;
        }

        $certificate = stream_context_get_params($client)['options']['ssl']['peer_certificate'] ?? null;
        fclose($client);

        $info = $certificate ? openssl_x509_parse($certificate) : false;

        if (! $info || ! isset($info['validTo_time_t'])) {
            return null;
        }

        return [
            'host' => $host,
            'issuer' => $info['issuer']['O'] ?? $info['issuer']['CN'] ?? null,
            'expires_at' => gmdate('Y-m-d\TH:i:s\Z', $info['validTo_time_t']),
        ];
    }

    /**
     * Remember the SERVER_SOFTWARE a web request was served by, for the next report.
     */
    public function rememberServerSoftware(mixed $software): void
    {
        if (! is_string($software) || ($software = trim($software)) === '') {
            return;
        }

        $file = $this->serverSoftwareFile();
        $software = substr($software, 0, 120);

        if (@file_get_contents($file) !== $software) {
            @mkdir(dirname($file), 0755, true);
            @file_put_contents($file, $software, LOCK_EX);
        }
    }

    /**
     * The web server in front of the app.
     *
     * Reports run from the CLI, which has no SERVER_SOFTWARE, so prefer what the last web request saw and fall back to
     * asking the web server binaries. Servers that hide their version only report their name.
     */
    protected function webServer(): ?string
    {
        $seen = @file_get_contents($this->serverSoftwareFile()) ?: null;

        if ($seen !== null && preg_match('/\d/', $seen)) {
            return $seen;
        }

        // Cached as '' when nothing is found, so missing binaries aren't probed every minute...
        return $this->remember('signal-agent:web-server', fn () => $this->webServerFromBinaries() ?? '') ?: $seen;
    }

    protected function webServerFromBinaries(): ?string
    {
        foreach ((array) config('signal-agent.web_server_binaries') as $binary) {
            try {
                $result = Process::timeout(10)->run([$binary, '-v']);
            } catch (Throwable) {
                continue;
            }

            // nginx prints its version to stderr...
            if (preg_match('#(Apache|nginx|openresty|LiteSpeed|Caddy)/v?(\d+(?:\.\d+)+)#i', $result->output().$result->errorOutput(), $m)) {
                return "{$m[1]}/{$m[2]}";
            }
        }

        return null;
    }

    protected function serverSoftwareFile(): string
    {
        return rtrim((string) config('signal-agent.spool_path'), '/\\').DIRECTORY_SEPARATOR.'server-software';
    }

    protected function remember(string $key, callable $callback): mixed
    {
        try {
            return Cache::remember($key, 3600, fn () => $this->safely($callback));
        } catch (Throwable) {
            return $this->safely($callback);
        }
    }

    protected function safely(callable $callback): mixed
    {
        try {
            return $callback();
        } catch (Throwable) {
            return null;
        }
    }
}
