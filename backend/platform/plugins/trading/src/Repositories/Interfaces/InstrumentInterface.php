<?php
namespace Platform\Plugins\Trading\Src\Repositories\Interfaces;

use Platform\Plugins\Trading\Src\Models\Instruments;

interface InstrumentInterface {
    public function create(array $instrument): Instruments;

    public function find(int $id): ?Instruments;

    public function findAll($filter, $select, $perPage);

    public function update(int $id, array $instrument): ?Instruments;

    public function delete(int $id): bool;
}