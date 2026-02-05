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

    public function findByField(string $field, $value): ?Instruments {
        return Instruments::where($field, $value)->first();
    }

    public function likeByField(string $field, $value): ?Instruments {
        return Instruments::where($field, 'LIKE', "%$value%")->first();
    }

    public function findAll($filter, $select, $perPage, $page, $orderBy): LengthAwarePaginator
    {
        if ($orderBy === null || $orderBy === '' || $orderBy === 'symbol') {
            $orderBy = 'symbol';
        } else {
            if ($orderBy === 'date'){ 
                $orderBy = 'updated_at';
            }
        }
        $query = Instruments::query()
            ->orderBy($orderBy, $orderBy === 'updated_at' ? 'desc' : 'asc')
            ->forPage($page, $perPage);

        if (!empty($filter)) {
            foreach ($filter as $field => $value) {
                $query->where("instruments.$field", 'LIKE', "%$value%");
            }
        }

        if (!empty($select)) {
            $query->addSelect($select);
        }

        return $query->paginate($perPage, ['*'], 'page', $page);
    }

    public function update(string $id, array $instrument): ?Instruments {
        $inst = Instruments::query()->find($id);
        if ($inst) {
            $inst->update($instrument);
            return $inst;
        }
        return null;
    }

    public function delete(string $id): bool {
        $inst = Instruments::query()->find($id);
        if ($inst) {
            return (bool)$inst->delete();
        }
        return false;
    }
}