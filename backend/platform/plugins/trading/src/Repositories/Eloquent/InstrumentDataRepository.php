<?php
namespace Platform\Plugins\Trading\Src\Repositories\Eloquent;
use Platform\Plugins\Trading\Src\Models\InstrumentData;
use Illuminate\Support\Facades\DB;
use Platform\Plugins\Trading\Src\Repositories\Interfaces\InstrumentDataInterface;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * Candle/OHLC queries MUST use instrument_period_id (indexed) — avoid LIKE on slug (full table scan).
 */
class InstrumentDataRepository implements InstrumentDataInterface {
    protected function snapshotTableByPeriod(string $period): ?string
    {
        return match (strtolower(trim($period))) {
            'daily' => 'snapshot_daily',
            'weekly' => 'snapshot_weekly',
            'monthly' => 'snapshot_monthly',
            'yearly' => 'snapshot_annual',
            default => null,
        };
    }

    /**
     * @return list<array{timestamp: string|null, open: float|null, high: float|null, low: float|null, close: float|null, volume: float|null}>
     */
    protected function loadSnapshotCandles(string $symbol, string $period): array
    {
        $table = $this->snapshotTableByPeriod($period);
        if ($table === null) {
            return [];
        }
        $row = DB::table($table)
            ->where('symbol', strtoupper(trim($symbol)))
            ->select(['candles', 'candles_count'])
            ->first();
        if (! $row || ! isset($row->candles)) {
            return [];
        }
        $decoded = json_decode((string) $row->candles, true);
        if (! is_array($decoded)) {
            return [];
        }
        $out = [];
        foreach ($decoded as $c) {
            if (! is_array($c)) {
                continue;
            }
            $out[] = [
                'timestamp' => isset($c['timestamp']) ? (string) $c['timestamp'] : null,
                'open' => isset($c['open']) && is_numeric($c['open']) ? (float) $c['open'] : null,
                'high' => isset($c['high']) && is_numeric($c['high']) ? (float) $c['high'] : null,
                'low' => isset($c['low']) && is_numeric($c['low']) ? (float) $c['low'] : null,
                'close' => isset($c['close']) && is_numeric($c['close']) ? (float) $c['close'] : null,
                'volume' => isset($c['volume']) && is_numeric($c['volume']) ? (float) $c['volume'] : null,
            ];
        }
        return $out;
    }

    public function create(array $instrumentData): InstrumentData {
        return InstrumentData::create($instrumentData);
    }

    public function find(string $id): ?InstrumentData {
        return InstrumentData::find($id);
    }

    public function get(string $symbol, string $period, int $perPage, int $page): LengthAwarePaginator
    {
        $period = $period !== '' && $period !== null ? strtolower((string) $period) : 'daily';

        // Fast path: serve from snapshot tables when requested page is within cached window.
        $snapshotCandles = $this->loadSnapshotCandles($symbol, $period);
        if (! empty($snapshotCandles)) {
            $total = count($snapshotCandles);
            $offset = max(0, ($page - 1) * $perPage);
            if ($offset < $total) {
                // Snapshots are stored oldest->newest; API expects newest->oldest pages.
                $desc = array_reverse($snapshotCandles);
                $slice = array_slice($desc, $offset, $perPage);
                return new LengthAwarePaginator(
                    $slice,
                    $total,
                    $perPage,
                    $page,
                    ['path' => LengthAwarePaginator::resolveCurrentPath(), 'pageName' => 'page']
                );
            }
            // Offset outside snapshot window -> fallback to instrument_data below.
        }

        $slug = strtolower((string) $symbol).'-'.$period;

        $periodId = DB::table('instrument_periods')->where('slug', $slug)->value('id');

        if (!$periodId) {
            return InstrumentData::query()
                ->whereRaw('1 = 0')
                ->paginate($perPage, ['*'], 'page', $page);
        }

        return InstrumentData::query()
            ->where('instrument_period_id', $periodId)
            ->orderByDesc('timestamps')
            ->selectRaw('timestamps as timestamp, open, high, low, close, volume')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Last N bars for a symbol/period, oldest first (for charts).
     *
     * @return list<array{timestamps: mixed, open: float|int|null, high: float|int|null, low: float|int|null, close: float|int|null, volume: float|int|null}>
     */
    public function getRecentBarsForSymbol(string $symbol, string $period, int $limit): array
    {
        $period = $period !== '' && $period !== null ? strtolower((string) $period) : 'daily';
        $slug = strtolower(trim((string) $symbol)).'-'.$period;
        $periodId = DB::table('instrument_periods')->where('slug', $slug)->value('id');
        if (! $periodId) {
            return [];
        }
        $limit = max(1, min($limit, 5000));
        $rows = InstrumentData::query()
            ->where('instrument_period_id', $periodId)
            ->orderByDesc('timestamps')
            ->limit($limit)
            ->selectRaw('timestamps as timestamp, open, high, low, close, volume')
            ->get();
        $out = [];
        foreach ($rows->reverse() as $row) {
            $out[] = [
                'timestamps' => $row->timestamp,
                'open' => $row->open !== null ? (float) $row->open : null,
                'high' => $row->high !== null ? (float) $row->high : null,
                'low' => $row->low !== null ? (float) $row->low : null,
                'close' => $row->close !== null ? (float) $row->close : null,
                'volume' => $row->volume !== null ? (float) $row->volume : null,
            ];
        }

        return $out;
    }

    /**
     * Daily closing prices for many symbols in one request (keys = uppercase symbol).
     *
     * @param  list<string>  $symbols
     * @return array<string, list<float>>
     */
    public function batchDailyCloses(array $symbols, int $limit): array
    {
        $limit = max(1, min($limit, 500));
        $symbols = array_values(array_unique(array_filter(array_map(
            fn ($s) => strtoupper(trim((string) $s)),
            $symbols
        ))));
        if ($symbols === []) {
            return [];
        }
        $symbols = array_slice($symbols, 0, 100);
        $slugToSymbol = [];
        $slugs = [];
        foreach ($symbols as $sym) {
            $slug = strtolower($sym).'-daily';
            $slugs[] = $slug;
            $slugToSymbol[$slug] = $sym;
        }
        $periodRows = DB::table('instrument_periods')->whereIn('slug', $slugs)->get(['id', 'slug']);
        $result = [];
        foreach ($symbols as $sym) {
            $result[$sym] = [];
        }
        foreach ($periodRows as $pr) {
            $sym = $slugToSymbol[$pr->slug] ?? null;
            if ($sym === null) {
                continue;
            }
            $closes = InstrumentData::query()
                ->where('instrument_period_id', $pr->id)
                ->orderByDesc('timestamps')
                ->limit($limit)
                ->pluck('close')
                ->all();
            $closes = array_map(fn ($c) => (float) $c, $closes);
            $result[$sym] = array_values(array_reverse($closes));
        }

        return $result;
    }

    /**
     * OHLC bars for {symbol}-{period} constrained by timestamps range (ascending).
     *
     * @return list<array{timestamps: mixed, open: float|int|null, high: float|int|null, low: float|int|null, close: float|int|null, volume: float|int|null}>
     */
    public function getHistoryRange(string $symbol, string $period, string $from, string $to): array
    {
        $period = $period !== '' && $period !== null ? strtolower((string) $period) : 'daily';
        $slug = strtolower(trim((string) $symbol)).'-'.$period;
        $periodId = DB::table('instrument_periods')->where('slug', $slug)->value('id');
        if (! $periodId) {
            return [];
        }

        $rows = InstrumentData::query()
            ->where('instrument_period_id', $periodId)
            ->whereBetween('timestamps', [$from, $to])
            ->orderBy('timestamps')
            ->selectRaw('timestamps as timestamp, open, high, low, close, volume')
            ->get();

        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                'timestamps' => $row->timestamp,
                'open' => $row->open !== null ? (float) $row->open : null,
                'high' => $row->high !== null ? (float) $row->high : null,
                'low' => $row->low !== null ? (float) $row->low : null,
                'close' => $row->close !== null ? (float) $row->close : null,
                'volume' => $row->volume !== null ? (float) $row->volume : null,
            ];
        }

        return $out;
    }

    public function findByPeriod(string $periodId, int $perPage): LengthAwarePaginator 
    {
        return InstrumentData::query()
            ->where('instrument_period_id', $periodId)
            ->orderByDesc('timestamps')
            ->paginate($perPage);
    }

    public function findAll($filter, $select, $perPage): LengthAwarePaginator
    {
        $query = InstrumentData::query()->orderByDesc('timestamps');

        if (!empty($filter)) {
            foreach ($filter as $field => $value) {
                if ($value === null || $value === '') {
                    continue;
                }
                $value = (string) $value;
                // Rows use slug like "nvda-daily", not a symbol column — avoid "%x%" (full table scan)
                if ($field === 'symbol') {
                    $sym = strtolower(trim($value));
                    $query->where('slug', 'like', $sym.'-%');
                    continue;
                }
                $query->where($field, 'LIKE', '%'.$value.'%');
            }
        }

        if (!empty($select)) {
            $query->select($select);
        }

        return $query->paginate($perPage);
    }

    public function findBySymbolAndPeriod(string $symbol, string $period, int $perPage, int $page): ?LengthAwarePaginator {
        $slug = strtolower($symbol).'-'.strtolower($period);
        $period_id = DB::table('instrument_periods')->where('slug', $slug)->value('id');
        return InstrumentData::query()
            ->where('instrument_period_id', $period_id)
            ->orderBy('timestamps', 'desc')
            ->select('timestamps as timestamp', 'open', 'high', 'low', 'close', 'volume')
            ->paginate($perPage, ['*'], 'page', $page);  
    }

    public function update(string $id, array $instrumentData): ?InstrumentData {
        $inst = InstrumentData::query()->find($id);
        if ($inst) {
            $inst->update($instrumentData);
            return $inst;
        }
        return null;
    }
}