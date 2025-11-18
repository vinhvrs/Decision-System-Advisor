<?php
namespace Platform\Plugins\Trading\Src\Repositories\Eloquent;

use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;
use Platform\Plugins\Trading\Src\Repositories\Interfaces\InstrumentPeriodsInterface;
use Illuminate\Pagination\LengthAwarePaginator;

class InstrumentPeriodsRepository implements InstrumentPeriodsInterface {
    public function where($field, $value) {
        return InstrumentPeriods::where($field, $value);
    }
    public function create(array $instrument): InstrumentPeriods {
        return InstrumentPeriods::create($instrument);
    }

    public function find(int $id): ?InstrumentPeriods {
        return InstrumentPeriods::find($id);
    }

    public function findAll($filter, $select, $perPage): LengthAwarePaginator {
        $query = InstrumentPeriods::query()->orderByDesc('updated_at');

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

    public function update(int $id, array $instrument): ?InstrumentPeriods {
        $inst = InstrumentPeriods::find($id);
        if ($inst) {
            $inst->update($instrument);
            return $inst;
        }
        return null;
    }

    public function delete(int $id): bool {
        $inst = InstrumentPeriods::find($id);
        if ($inst) {
            return (bool)$inst->delete();
        }
        return false;
    }
}