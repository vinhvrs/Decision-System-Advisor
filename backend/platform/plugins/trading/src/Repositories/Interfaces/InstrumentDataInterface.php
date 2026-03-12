<?php
namespace Platform\Plugins\Trading\Src\Repositories\Interfaces;
use Platform\Plugins\Trading\Src\Models\InstrumentData;
use Illuminate\Pagination\LengthAwarePaginator;

interface InstrumentDataInterface {
    public function create(array $instrumentData): InstrumentData;
    public function get(string $symbol, string $period, int $perPage, int $page);
    public function find(string $id): ?InstrumentData;
    public function findAll($filter, $select, $perPage): LengthAwarePaginator;
    public function findBySymbolAndPeriod(string $symbol, string $period, int $perPage, int $page): ?LengthAwarePaginator;
    public function update(string $id, array $instrumentData): ?InstrumentData;
}