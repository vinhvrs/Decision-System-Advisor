<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Resolve logical table names from DEV_MODE (dev → *_demo, production → production).
 */
final class DsaTables
{
    public static function devMode(): string
    {
        return strtolower(trim((string) config('dsa.dev_mode', 'dev')));
    }

    public static function useDemo(): bool
    {
        return (bool) config('dsa.use_demo_tables', true);
    }

    public static function name(string $logical): string
    {
        $tables = config("dsa.tables.{$logical}");
        if (! is_array($tables) || ! isset($tables['production'], $tables['demo'])) {
            throw new InvalidArgumentException("Unknown logical DSA table: {$logical}");
        }

        return self::useDemo() ? (string) $tables['demo'] : (string) $tables['production'];
    }

    /** @return array<string, string> logical => physical */
    public static function allResolved(): array
    {
        $out = [];
        foreach (array_keys(config('dsa.tables', [])) as $logical) {
            $out[$logical] = self::name($logical);
        }

        return $out;
    }
}
