<?php
namespace Platform\Plugins\Trading\Src\Repositories\Interfaces;

use Platform\Plugins\Trading\Src\Models\StockAttribute;
use Illuminate\Pagination\LengthAwarePaginator;

interface StockInterface {
    public function create(array $stock): StockAttribute;

    public function find(int $id): ?StockAttribute;

    public function findAll($filter, $select, $perPage): LengthAwarePaginator;

    public function update(int $id, array $stock): ?StockAttribute;

    public function delete(int $id): bool;
}