<?php
namespace Platform\Plugins\Trading\Src\Repositories\Eloquent;

use Platform\Plugins\Trading\Src\Models\Instruments;
use Platform\Plugins\Trading\Src\Repositories\Interfaces\InstrumentInterface;
use Illuminate\Pagination\LengthAwarePaginator;

class InstrumentRepository implements InstrumentInterface {
    public function insert(array $instruments): void {
        set_time_limit(0);
        foreach ($instruments as $instrument) {
            Instruments::updateOrCreate(
                ['symbol' => $instrument['symbol']],
                $instrument
            );
        }
    }

    public function create(array $instrument): Instruments {
        return Instruments::create($instrument);
    }

    public function find(string $id): ?Instruments {
        return Instruments::find($id);
    }

    public function findAll($filter, $select, $perPage): LengthAwarePaginator {
        $query = Instruments::query()->orderBy('symbol', 'asc');

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

    public function update(string $id, array $instrument): ?Instruments {
        $inst = Instruments::find($id);
        if ($inst) {
            $inst->update($instrument);
            return $inst;
        }
        return null;
    }

    public function delete(string $id): bool {
        $inst = Instruments::find($id);
        if ($inst) {
            return (bool)$inst->delete();
        }
        return false;
    }
}