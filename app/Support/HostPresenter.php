<?php

namespace App\Support;

use App\Models\Host;
use Illuminate\Support\Str;

/**
 * Shapes hosts for the frontend and flags outdated or end-of-life stacks.
 */
class HostPresenter
{
    /**
     * Components compared across the fleet to flag hosts that fall behind.
     */
    protected const COMPARED = ['php' => 'php_version', 'laravel' => 'laravel_version', 'composer' => 'composer_version', 'node' => 'node_version'];

    protected const DATABASES = ['mysql' => 'MySQL', 'mariadb' => 'MariaDB', 'pgsql' => 'PostgreSQL', 'sqlite' => 'SQLite', 'sqlsrv' => 'SQL Server'];

    /**
     * @param  array<string, string|null>  $latest  newest version seen across the fleet, per component
     * @return array<string, mixed>
     */
    public static function present(Host $host, array $latest = []): array
    {
        return [
            'id' => $host->id,
            'hostname' => $host->hostname,
            'online' => $host->isOnline(),
            'last_seen_at' => $host->last_seen_at?->toIso8601String(),
            'os' => trim($host->os_name.' '.$host->os_version) ?: null,
            'kernel' => $host->kernel,
            'cpu_cores' => $host->cpu_cores,
            'cpu_percent' => $host->cpu_percent,
            'memory_percent' => $host->memoryPercent(),
            'memory_used' => $host->memory_used,
            'memory_total' => $host->memory_total,
            'disk_percent' => $host->diskPercent(),
            'disk_used' => $host->disk_used,
            'disk_total' => $host->disk_total,
            'load' => [$host->load_1, $host->load_5, $host->load_15],
            'uptime_seconds' => $host->uptime_seconds,
            'versions' => [
                'php' => self::version($host->php_version, 'php', $latest['php'] ?? null),
                'laravel' => self::version($host->laravel_version, 'laravel', $latest['laravel'] ?? null),
                'composer' => self::version($host->composer_version, null, $latest['composer'] ?? null),
                'node' => self::version($host->node_version, 'node', $latest['node'] ?? null),
                'database' => self::database($host->database_version),
                'web_server' => self::webServer($host->web_server),
            ],
        ];
    }

    /**
     * The host's software, keyed by component, e.g. ['php' => '8.3.12', 'mariadb' => '10.11.6', 'apache' => '2.4.58'].
     *
     * @return array<string, string>
     */
    public static function stack(Host $host): array
    {
        $stack = [];

        foreach (self::COMPARED as $component => $column) {
            if ($host->{$column}) {
                $stack[$component] = self::normalize($host->{$column});
            }
        }

        // Databases and web servers are named by product; versions hidden by the server can't be looked up...
        foreach ([self::database($host->database_version), self::webServer($host->web_server)] as $product) {
            if ($product && $product['name'] && preg_match('/^\d+(\.\d+)+$/', $product['value'])) {
                $stack[strtolower($product['name'])] = $product['value'];
            }
        }

        return $stack;
    }

    /**
     * Newest version of each compared component across the given hosts.
     *
     * @param  iterable<Host>  $hosts
     * @return array<string, string|null>
     */
    public static function latestVersions(iterable $hosts): array
    {
        $latest = array_fill_keys(array_keys(self::COMPARED), null);

        foreach ($hosts as $host) {
            foreach (self::COMPARED as $key => $column) {
                $version = $host->{$column};

                if ($version && ($latest[$key] === null || version_compare(self::normalize($version), self::normalize($latest[$key]), '>'))) {
                    $latest[$key] = $version;
                }
            }
        }

        return $latest;
    }

    /**
     * @return array{name: string|null, value: string, state: string}|null
     */
    protected static function version(?string $version, ?string $eolKey, ?string $latest, ?string $name = null): ?array
    {
        if (! $version) {
            return null;
        }

        $normalized = self::normalize($version);

        $state = match (true) {
            $eolKey !== null && Str::startsWith($normalized, config("signal.eol.{$eolKey}", [])) => 'eol',
            $latest !== null && version_compare($normalized, self::normalize($latest), '<') => 'behind',
            default => 'current',
        };

        return ['name' => $name, 'value' => $normalized, 'state' => $state];
    }

    /**
     * Split "<driver> <server version>" (e.g. "mysql 10.11.6-MariaDB-0ubuntu0.24.04.1") into product and version.
     *
     * @return array{name: string|null, value: string, state: string}|null
     */
    protected static function database(?string $reported): ?array
    {
        if (! $reported) {
            return null;
        }

        [$driver, $server] = array_pad(explode(' ', $reported, 2), 2, '');

        // MariaDB answers through the mysql driver, sometimes behind a "5.5.5-" compatibility prefix...
        if (preg_match('/(\d+\.\d+\.\d+)-MariaDB/i', $server, $m)) {
            return self::version($m[1], null, null, 'MariaDB');
        }

        $name = self::DATABASES[strtolower($driver)] ?? $driver;
        $number = preg_match('/\d+(?:\.\d+)+/', $server, $m) ? $m[0] : $server;

        return $number === '' ? null : self::version($number, $name === 'MySQL' ? 'mysql' : null, null, $name);
    }

    /**
     * Split a SERVER_SOFTWARE string (e.g. "Apache/2.4.58 (Ubuntu)") into product and version.
     *
     * @return array{name: string|null, value: string, state: string}|null
     */
    protected static function webServer(?string $reported): ?array
    {
        if (! $reported) {
            return null;
        }

        if (preg_match('#^([A-Za-z][\w-]*)/v?(\d+(?:\.\d+)*)#', trim($reported), $m)) {
            return self::version($m[2], null, null, $m[1]);
        }

        // Servers configured to hide their version (ServerTokens Prod, server_tokens off)...
        return ['name' => null, 'value' => trim($reported), 'state' => 'current'];
    }

    protected static function normalize(string $version): string
    {
        return ltrim($version, 'vV');
    }
}
