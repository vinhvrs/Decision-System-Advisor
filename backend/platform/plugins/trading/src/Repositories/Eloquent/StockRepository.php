<?php
namespace Platform\Plugins\Trading\Src\Repositories\Eloquent;

use App\Support\DsaTables;
use Platform\Plugins\Trading\Src\Models\StockAttribute;
use Platform\Plugins\Trading\Src\Repositories\Interfaces\StockInterface;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class StockRepository implements StockInterface {
    public function create(array $stock): StockAttribute {
        return StockAttribute::create($stock);
    }

    public function find(string $id): ?StockAttribute {
        return StockAttribute::find($id);
    }

    public function findByField(string $field, $value): ?StockAttribute {
        return StockAttribute::where($field, $value)->first();
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

    public function getCurrentPrice(string $symbol, string $period = 'daily'): ?float
    {
        $price = DB::table(DsaTables::name('instrument_data').' as d')
            ->join(DsaTables::name('instrument_periods').' as ip', 'ip.id', '=', 'd.instrument_period_id')
            ->join(DsaTables::name('instruments').' as i', 'i.id', '=', 'ip.instrument_id')
            ->where('i.symbol', $symbol)
            ->where('ip.period', $period ?? 'daily')
            ->orderByDesc('d.created_at')
            ->value('d.close') ?? 0.0;

        return is_numeric($price) ? (float)$price : null;
    }

    public function update(string $id, array $stock): ?StockAttribute {
        $attribute = StockAttribute::find($id);
        if ($attribute instanceof StockAttribute) {
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
        if ($attribute instanceof StockAttribute) {
            return (bool)$attribute->delete();
        }
        return false;
    }
}

