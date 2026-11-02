<?php

namespace Signal\Agent;

/**
 * Append-only local buffer of telemetry, drained by `signal:report`.
 *
 * Each line is one JSON object of item lists keyed by kind (requests, jobs, logs, exceptions).
 */
class Spool
{
    public function __construct(protected string $directory, protected int $maxBytes)
    {
        //
    }

    /**
     * @param  array<string, list<array<string, mixed>>>  $items
     */
    public function append(array $items): void
    {
        $items = array_filter($items);

        if ($items === []) {
            return;
        }

        $file = $this->file();

        if (! is_dir($this->directory)) {
            @mkdir($this->directory, 0755, true);
        }

        // Drop data rather than fill the disk while the dashboard is unreachable...
        if (is_file($file) && filesize($file) > $this->maxBytes) {
            return;
        }

        $line = json_encode($items, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);

        if ($line !== false) {
            @file_put_contents($file, $line."\n", FILE_APPEND | LOCK_EX);
        }
    }

    /**
     * Atomically take everything spooled so far.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function drain(): array
    {
        $file = $this->file();

        // Files claimed by a run that crashed before finishing are picked up again...
        $claimed = array_filter(glob($file.'.*') ?: [], fn ($f) => filemtime($f) < time() - 600);

        // Renaming hands the current file to us; writers start a fresh one...
        $mine = $file.'.'.getmypid().'.'.bin2hex(random_bytes(4));

        if (is_file($file) && @rename($file, $mine)) {
            $claimed[] = $mine;
        }

        $items = [];

        foreach ($claimed as $path) {
            foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                foreach ((array) json_decode($line, true) as $kind => $list) {
                    $items[$kind] = array_merge($items[$kind] ?? [], array_values((array) $list));
                }
            }

            @unlink($path);
        }

        return $items;
    }

    protected function file(): string
    {
        return $this->directory.DIRECTORY_SEPARATOR.'spool.ndjson';
    }
}
