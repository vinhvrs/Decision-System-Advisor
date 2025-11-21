<?php
namespace Platform\Plugins\Trading\Src\Repositories\Eloquent;

use Platform\Plugins\Trading\Src\Models\StockAttribute;
use Platform\Plugins\Trading\Src\Repositories\Interfaces\StockInterface;
use Illuminate\Pagination\LengthAwarePaginator;

class StockRepository implements StockInterface {
    public function create(array $stock): StockAttribute {
        return StockAttribute::create($stock);
    }

    public function find(string $id): ?StockAttribute {
        return StockAttribute::find($id);
    }

    public function findAll($filter, $select, $perPage): LengthAwarePaginator {
        $query = StockAttribute::query()->orderByDesc('updated_at');

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

    public function update(string $id, array $stock): ?StockAttribute {
        $attribute = StockAttribute::find($id);
        if ($attribute) {
            $attribute->update($stock);
            return $attribute;
        }
        return null;
    }

    public function createOrUpdate(array $stock): StockAttribute {
        return StockAttribute::updateOrCreate(
            [
                'instrument_id' => $stock['instrument_id'],
            ],
            $stock
        );
    }

    public function delete(string $id): bool {
        $attribute = StockAttribute::find($id);
        if ($attribute) {
            return (bool)$attribute->delete();
        }
        return false;
    }
}

