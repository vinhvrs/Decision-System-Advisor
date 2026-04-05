<?php

namespace App\Services;

/**
 * Parses monolog-style Laravel log file lines into structured entries.
 */
class LaravelLogParser
{
    /**
     * @param  list<string>|null  $levels  Uppercase e.g. ERROR, WARNING — null = all
     * @return list<array{at: string|null, env: string|null, level: string, message: string, raw: string}>
     */
    public function parseTail(string $text, ?int $maxEntries = 500, ?array $levels = null): array
    {
        $lines = preg_split('/\r\n|\r|\n/', $text) ?: [];
        $entries = [];
        $current = null;

        foreach ($lines as $line) {
            if (preg_match(
                '/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] ([^.]+)\.(\w+): (.+)$/',
                $line,
                $m
            )) {
                if ($current !== null) {
                    $entries[] = $current;
                }
                $current = [
                    'at' => $m[1],
                    'env' => $m[2],
                    'level' => strtoupper($m[3]),
                    'message' => $m[4],
                    'raw' => $line,
                ];
            } elseif ($current !== null && trim($line) !== '') {
                $current['message'] .= "\n".$line;
                $current['raw'] .= "\n".$line;
            }
        }

        if ($current !== null) {
            $entries[] = $current;
        }

        $entries = array_slice($entries, -$maxEntries);

        if ($levels !== null && $levels !== []) {
            $set = array_map('strtoupper', $levels);
            $entries = array_values(array_filter(
                $entries,
                static fn (array $e) => in_array($e['level'], $set, true)
            ));
        }

        return array_reverse($entries);
    }
}
