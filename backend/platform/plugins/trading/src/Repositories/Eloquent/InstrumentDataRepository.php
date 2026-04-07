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
    public function create(array $instrumentData): InstrumentData {
        return InstrumentData::create($instrumentData);
    }

    public function find(string $id): ?InstrumentData {
        return InstrumentData::find($id);
    }

    public function get(string $symbol, string $period, int $perPage, int $page): LengthAwarePaginator
    {
        $period = $period !== '' && $period !== null ? strtolower((string) $period) : 'daily';
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
            ->select(['timestamps', 'open', 'high', 'low', 'close', 'volume'])
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
            ->select(['timestamps', 'open', 'high', 'low', 'close', 'volume'])
            ->get();
        $out = [];
        foreach ($rows->reverse() as $row) {
            $out[] = [
                'timestamps' => $row->timestamps,
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