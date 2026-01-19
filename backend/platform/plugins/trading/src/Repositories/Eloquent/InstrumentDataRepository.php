<?php
namespace Platform\Plugins\Trading\Src\Repositories\Eloquent;
use Platform\Plugins\Trading\Src\Models\InstrumentData;
use Illuminate\Support\Facades\DB;
use Platform\Plugins\Trading\Src\Repositories\Interfaces\InstrumentDataInterface;
use Illuminate\Pagination\LengthAwarePaginator;

class InstrumentDataRepository implements InstrumentDataInterface {
    public function create(array $instrumentData): InstrumentData {
        return InstrumentData::create($instrumentData);
    }

    public function find(string $id): ?InstrumentData {
        return InstrumentData::find($id);
    }

    public function findByPeriod($periodId, $perPage): ?LengthAwarePaginator {
        return InstrumentData::query()
            ->where('instrument_period_id', $periodId)
            ->orderByDesc('timestamps')
            ->paginate($perPage);
    }

    public function findAll($filter, $select, $perPage): LengthAwarePaginator {
        $query = InstrumentData::query()->orderByDesc('timestamps');

        if (!empty($filter)) {
            foreach ($filter as $field => $value) {
                $query->where($field, 'LIKE', "%$value%");
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
        $inst = InstrumentData::find($id);
        if ($inst) {
            $inst->update($instrumentData);
            return $inst;
        }
        return null;
    }

    public function delete(string $id): bool {
        $inst = InstrumentData::find($id);
        if ($inst) {
            return (bool)$inst->delete();
        }
        return false;
    }
}