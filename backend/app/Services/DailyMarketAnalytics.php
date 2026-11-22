<?php

namespace App\Services;

final class DailyMarketAnalytics
{
    /** @param list<object> $bars Distinct sessions in ascending order. */
    public static function summarize(array $bars, callable $allowsSource): array
    {
        $asOf = $bars ? substr((string) end($bars)->timestamps, 0, 10) : null;
        $metrics = [];
        $add = static function (string $key, ?float $value, array $window, string $unit, ?string $reason = null) use (&$metrics, $asOf, $allowsSource): void {
            $sources = array_unique(array_map(fn ($bar) => $bar->source ?: 'UNKNOWN', $window));
            sort($sources);
            $restricted = array_filter($sources, fn ($source) => !$allowsSource($source)) !== [];
            $metrics[$key] = [
                'value' => $restricted ? null : $value,
                'quality' => $restricted ? 'LICENSE_RESTRICTED' : ($value !== null ? 'OK' : ($asOf ? 'PARTIAL' : 'NOT_INGESTED')),
                'as_of' => $asOf,
                'unit' => $unit,
                'reason' => $restricted ? 'Historical source policy does not allow this metric'
                    : ($value === null ? ($asOf ? $reason : 'No finalized daily bars') : null),
                'metadata' => ['source' => $sources ? implode(', ', $sources) : null],
            ];
        };

        foreach ([20, 50, 200] as $length) {
            $window = array_slice($bars, -$length);
            $closes = array_column($window, 'close');
            $valid = count($closes) === $length && self::allPositive($closes);
            $ma = $valid ? array_sum($closes) / $length : null;
            $reason = "Requires $length daily sessions with valid closes";
            $add("sma$length", $ma, $window, 'price', $reason);
            $add("above_sma$length", $valid ? (float) (end($closes) > $ma) : null, $window, 'flag', $reason);
        }

        $volumeWindow = array_slice($bars, -21);
        $volume = array_column($volumeWindow, 'volume');
        $current = array_pop($volume);
        $validVolume = count($volume) === 20 && self::allPositive($volume)
            && count(array_unique(array_column($volumeWindow, 'source'))) === 1
            && !empty($volumeWindow[0]->source);
        $average = $validVolume ? array_sum($volume) / 20 : null;
        $add('average_volume20', $average, array_slice($volumeWindow, 0, -1), 'volume',
            'Requires 20 preceding sessions with positive volume from the same source');
        $add('rvol20', $average !== null && is_numeric($current) && $current > 0 ? (float) $current / $average : null,
            $volumeWindow, 'ratio', 'Requires current volume and 20 preceding comparable sessions');

        $cutoff = $asOf ? (new \DateTimeImmutable($asOf))->modify('-52 weeks')->format('Y-m-d') : null;
        $window = array_values(array_filter($bars, fn ($bar) => substr((string) $bar->timestamps, 0, 10) > $cutoff));
        $fullYear = $cutoff !== null && substr((string) $bars[0]->timestamps, 0, 10) <= $cutoff;
        foreach (['high' => 'max', 'low' => 'min'] as $field => $reduce) {
            $values = array_column($window, $field);
            $add("trading_52w_$field", $fullYear && $values && self::allPositive($values) ? (float) $reduce($values) : null,
                $window, 'price', 'Requires 52 weeks of daily history with valid observations');
        }

        return ['as_of' => $asOf, 'metrics' => $metrics];
    }

    private static function allPositive(array $values): bool
    {
        foreach ($values as $value) {
            if (!is_numeric($value) || !is_finite((float) $value) || $value <= 0) {
                return false;
            }
        }

        return true;
    }
}
