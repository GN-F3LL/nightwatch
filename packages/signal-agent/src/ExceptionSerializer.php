<?php

namespace Signal\Agent;

use Illuminate\Support\Str;
use Throwable;

class ExceptionSerializer
{
    protected const MAX_FRAMES = 60;

    protected const SNIPPET_RADIUS = 5;

    public function __construct(protected string $basePath)
    {
        $this->basePath = rtrim(str_replace('\\', '/', $basePath), '/').'/';
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(Throwable $e): array
    {
        $frames = [[
            'file' => $this->relative($e->getFile()),
            'line' => $e->getLine(),
            'class' => null,
            'function' => null,
            'app' => $this->isApp($e->getFile()),
            'absolute' => $e->getFile(),
        ]];

        foreach (array_slice($e->getTrace(), 0, self::MAX_FRAMES) as $frame) {
            $frames[] = [
                'file' => isset($frame['file']) ? $this->relative($frame['file']) : null,
                'line' => $frame['line'] ?? null,
                'class' => $frame['class'] ?? null,
                'function' => $frame['function'] ?? null,
                'app' => isset($frame['file']) && $this->isApp($frame['file']),
                'absolute' => $frame['file'] ?? null,
            ];
        }

        // Group by the first frame in the app's own code, so e.g. every QueryException
        // isn't lumped together under the framework file that throws it...
        $origin = collect($frames)->first(fn ($f) => $f['app']) ?? $frames[0];

        return [
            'class' => get_class($e),
            'message' => Str::limit($e->getMessage(), 2000),
            'file' => $origin['file'],
            'line' => $origin['line'],
            'code' => $this->snippet($origin['absolute'], $origin['line']),
            'trace' => array_map(fn ($f) => array_diff_key($f, ['absolute' => true]), $frames),
        ];
    }

    /**
     * Source lines around the line that threw.
     *
     * @return array{file: string, line: int, start: int, lines: list<string>}|null
     */
    protected function snippet(?string $file, ?int $line): ?array
    {
        if (! $file || ! $line || ! is_file($file) || ! is_readable($file) || filesize($file) > 1024 * 1024) {
            return null;
        }

        $lines = @file($file, FILE_IGNORE_NEW_LINES);

        if ($lines === false) {
            return null;
        }

        $start = max(1, $line - self::SNIPPET_RADIUS);
        $slice = array_slice($lines, $start - 1, self::SNIPPET_RADIUS * 2 + 1);

        return [
            'file' => $this->relative($file),
            'line' => $line,
            'start' => $start,
            'lines' => array_map(fn ($l) => mb_strimwidth(rtrim($l), 0, 300, '…'), $slice),
        ];
    }

    protected function isApp(string $file): bool
    {
        $file = str_replace('\\', '/', $file);

        return str_starts_with($file, $this->basePath) && ! str_starts_with($file, $this->basePath.'vendor/');
    }

    protected function relative(string $file): string
    {
        $file = str_replace('\\', '/', $file);

        return str_starts_with($file, $this->basePath) ? substr($file, strlen($this->basePath)) : $file;
    }
}
