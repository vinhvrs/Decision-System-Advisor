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