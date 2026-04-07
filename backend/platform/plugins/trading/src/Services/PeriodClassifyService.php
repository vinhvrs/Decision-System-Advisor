<?php

namespace Platform\Plugins\Trading\Src\Services;

use Platform\Plugins\Trading\Src\Repositories\Eloquent\InstrumentDataRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class PeriodClassifyService
{
    protected InstrumentDataRepository $instrumentDataRepository;

    public function __construct(InstrumentDataRepository $instrumentDataRepository)
    {
        $this->instrumentDataRepository = $instrumentDataRepository;
    }

    /**
     * Return candles for requested period.
     * basePeriod: daily|weekly|monthly|yearly
     *
     * - If basePeriod=daily: return raw daily candles
     * - If basePeriod=weekly/monthly/yearly: aggregate from daily candles (OHLCV)
     */
    public function classifyPeriods(string $symbol, string $basePeriod = 'daily'): Collection
    {
        $basePeriod = strtolower($basePeriod);

        // always fetch DAILY candles then aggregate (accurate)
        $dailyPaginator = $this->instrumentDataRepository->findBySymbolAndPeriod($symbol, 'daily', 1000, 1);
        \Log::info("Fetched ".($dailyPaginator ? $dailyPaginator->total() : 0)." daily candles for symbol=$symbol with basePeriod=$basePeriod");

        if (!$dailyPaginator) {
            return collect();
        }

        $daily = $dailyPaginator->getCollection();
        if (!$daily instanceof Collection) {
            $daily = collect($daily);
        }

        if ($daily->isEmpty()) {
            return collect();
        }

        // Normalize field names:
        // DB rows may use: timestamps vs timestamp
        $daily = $daily->map(function ($r) {
            // support object or array
            $ts = is_array($r) ? ($r['timestamp'] ?? $r['timestamps'] ?? null) : ($r->timestamp ?? $r->timestamps ?? null);

            $open   = is_array($r) ? ($r['open'] ?? null)   : ($r->open ?? null);
            $high   = is_array($r) ? ($r['high'] ?? null)   : ($r->high ?? null);
            $low    = is_array($r) ? ($r['low'] ?? null)    : ($r->low ?? null);
            $close  = is_array($r) ? ($r['close'] ?? null)  : ($r->close ?? null);
            $volume = is_array($r) ? ($r['volume'] ?? 0)    : ($r->volume ?? 0);

            return (object) [
                'timestamp' => $ts,
                'open' => (float) $open,
                'high' => (float) $high,
                'low' => (float) $low,
                'close' => (float) $close,
                'volume' => (float) $volume,
            ];
        });

        $daily = $this->sortByTimestamp($daily);

        return match ($basePeriod) {
            'daily'   => $daily->values(),
            'weekly'  => $this->dailyToWeekly($daily),
            'monthly' => $this->dailyToMonthly($daily),
            'yearly'  => $this->dailyToYearly($daily),
            default   => $daily->values(),
        };
    }

    // ========================= Converters =========================

    public function dailyToWeekly(Collection $dailyData): Collection
    {
        if ($dailyData->isEmpty()) return collect();

        $dailyData = $this->sortByTimestamp($dailyData);

        // ISO week key: "YYYY-WW"
        $grouped = $dailyData->groupBy(function ($r) {
            $ts = $this->getField($r, 'timestamp');
            return date('o-W', strtotime((string) $ts)); // ISO year-week (Mon start)
        });

        return $grouped->map(fn(Collection $g) => $this->aggregateOHLCV($g))->values();
    }

    public function dailyToMonthly(Collection $dailyData): Collection
    {
        if ($dailyData->isEmpty()) return collect();

        $dailyData = $this->sortByTimestamp($dailyData);

        $grouped = $dailyData->groupBy(function ($r) {
            $ts = $this->getField($r, 'timestamp');
            return date('YYYY-MM', strtotime((string) $ts)); // month key
        });

        return $grouped->map(fn(Collection $g) => $this->aggregateOHLCV($g))->values();
    }

    public function dailyToYearly(Collection $dailyData): Collection
    {
        if ($dailyData->isEmpty()) return collect();

        $dailyData = $this->sortByTimestamp($dailyData);

        $grouped = $dailyData->groupBy(function ($r) {
            $ts = $this->getField($r, 'timestamp');
            return date('Y', strtotime((string) $ts)); // year key
        });

        return $grouped->map(fn(Collection $g) => $this->aggregateOHLCV($g))->values();
    }

    public function weeklyToMonthly(Collection $weeklyData): Collection
    {
        if ($weeklyData->isEmpty()) return collect();

        $weeklyData = $this->sortByTimestamp($weeklyData);

        $grouped = $weeklyData->groupBy(function ($r) {
            $ts = $this->getField($r, 'timestamp'); // week-ending timestamp
            return date('Y-m', strtotime((string) $ts));
        });

        return $grouped->map(fn(Collection $g) => $this->aggregateOHLCV($g))->values();
    }

    public function weeklyToYearly(Collection $weeklyData): Collection
    {
        if ($weeklyData->isEmpty()) return collect();

        $weeklyData = $this->sortByTimestamp($weeklyData);

        $grouped = $weeklyData->groupBy(function ($r) {
            $ts = $this->getField($r, 'timestamp');
            return date('Y', strtotime((string) $ts));
        });

        return $grouped->map(fn(Collection $g) => $this->aggregateOHLCV($g))->values();
    }

    public function monthlyToYearly(Collection $monthlyData): Collection
    {
        if ($monthlyData->isEmpty()) return collect();

        $monthlyData = $this->sortByTimestamp($monthlyData);

        $grouped = $monthlyData->groupBy(function ($r) {
            $ts = $this->getField($r, 'timestamp');
            return date('Y', strtotime((string) $ts));
        });

        return $grouped->map(fn(Collection $g) => $this->aggregateOHLCV($g))->values();
    }

    // ========================= Helpers =========================

    private function sortByTimestamp(Collection $data): Collection
    {
        return $data->sortBy(function ($r) {
            $ts = $this->getField($r, 'timestamp');
            return strtotime((string) $ts);
        })->values();
    }

    private function getField($row, string $key)
    {
        if (is_array($row)) return $row[$key] ?? null;
        if (is_object($row)) return $row->{$key} ?? null;
        return null;
    }

    /**
     * Aggregate OHLCV for a grouped set of candles.
     * open: first.open
     * close: last.close
     * high: max(high)
     * low: min(low)
     * volume: sum(volume)
     * timestamp: last.timestamp (represents end of period)
     */
    private function aggregateOHLCV(Collection $group): object
    {
        $group = $this->sortByTimestamp($group);

        $first = $group->first();
        $last  = $group->last();

        $open   = (float) $this->getField($first, 'open');
        $close  = (float) $this->getField($last, 'close');
        $high   = (float) $group->max(fn($x) => (float) $this->getField($x, 'high'));
        $low    = (float) $group->min(fn($x) => (float) $this->getField($x, 'low'));
        $volume = (float) $group->sum(fn($x) => (float) ($this->getField($x, 'volume') ?? 0));

        $timestamp = $this->getField($last, 'timestamp');

        return (object) [
            'timestamp' => $timestamp,
            'open' => $open,
            'high' => $high,
            'low' => $low,
            'close' => $close,
            'volume' => $volume,
        ];
    }
}
