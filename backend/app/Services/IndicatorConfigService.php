<?php

namespace App\Services;

use App\Models\IndicatorParameter;
use Illuminate\Support\Facades\Cache;

/**
 * Resolved indicator tunables: DB (admin UI) → env/config fallback.
 *
 * Prefer this over reading trading_indicators config directly so Laravel and Python
 * share the same MySQL rows edited under Admin → Indicator params.
 */
class IndicatorConfigService
{
    public const CACHE_KEY = 'indicator_config.resolved.v1';

    public const CACHE_TTL_SECONDS = 60;

    /** Map indicators.slug + param_key → flat config key used by Laravel/Python. */
    private const SLUG_PARAM_TO_CONFIG = [
        'global.default_period' => 'default_period',
        'sma.period' => 'sma_period',
        'ema.period' => 'ema_period',
        'rsi.period' => 'rsi_period',
        'macd.fast_period' => 'macd_fast_period',
        'macd.slow_period' => 'macd_slow_period',
        'macd.signal_period' => 'macd_signal_period',
        'stochastic.k_period' => 'stochastic_k_period',
        'stochastic.d_period' => 'stochastic_d_period',
        'stochastic.smooth_k' => 'stochastic_smooth_k',
        'bollinger.period' => 'bollinger_period',
        'bollinger.std_dev_multiplier' => 'bollinger_std_dev_multiplier',
        'ema_trend.fast_period' => 'ema_fast_period',
        'ema_trend.slow_period' => 'ema_slow_period',
    ];

    public function flushCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /** @return array<string, mixed> */
    public function all(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, function () {
            return $this->loadResolved();
        });
    }

    public function getString(string $key, string $fallback = ''): string
    {
        $value = $this->all()[$key] ?? $fallback;

        return is_string($value) ? trim($value) : (string) $value;
    }

    public function getInt(string $key, int $fallback): int
    {
        $value = $this->all()[$key] ?? $fallback;
        $n = is_numeric($value) ? (int) $value : $fallback;

        return $n > 0 ? $n : $fallback;
    }

    public function getFloat(string $key, float $fallback): float
    {
        $value = $this->all()[$key] ?? $fallback;
        $n = is_numeric($value) ? (float) $value : $fallback;

        return $n > 0 ? $n : $fallback;
    }

    /** @return array<string, mixed> */
    private function loadResolved(): array
    {
        $resolved = config('trading_indicators', []);
        if (! is_array($resolved)) {
            $resolved = [];
        }

        $rows = IndicatorParameter::query()
            ->with('indicator:id,slug')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('param_key')
            ->get();

        $dbHits = 0;

        foreach ($rows as $row) {
            $slug = (string) ($row->indicator?->slug ?? '');
            if ($slug === '') {
                continue;
            }

            $composite = "{$slug}.{$row->param_key}";
            $configKey = self::SLUG_PARAM_TO_CONFIG[$composite] ?? null;
            if ($configKey === null) {
                continue;
            }

            $resolved[$configKey] = $this->castValue(
                $row->param_value,
                (string) $row->value_type
            );
            $dbHits++;
        }

        $resolved['_meta'] = [
            'source' => $dbHits > 0 ? 'database' : 'env',
            'active_parameters' => $dbHits,
        ];

        return $resolved;
    }

    private function castValue(?string $raw, string $type): mixed
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        return match ($type) {
            'number' => str_contains($raw, '.') ? (float) $raw : (int) $raw,
            'boolean' => filter_var($raw, FILTER_VALIDATE_BOOLEAN),
            'json' => json_decode($raw, true) ?? $raw,
            default => $raw,
        };
    }
}
