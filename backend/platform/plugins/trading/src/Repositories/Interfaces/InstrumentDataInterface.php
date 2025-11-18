<?php
namespace Platform\Plugins\Trading\Src\Repositories\Interfaces;
use Platform\Plugins\Trading\Src\Models\InstrumentData;

interface InstrumentDataInterface {
    public function create(array $instrumentData): InstrumentData;

    public function find(int $id): ?InstrumentData;

    public function findAll($filter, $select, $perPage);

    public function update(int $id, array $instrumentData): ?InstrumentData;

    public function delete(int $id): bool;
}