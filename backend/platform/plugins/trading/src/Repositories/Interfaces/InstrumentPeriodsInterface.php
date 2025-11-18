<?php
namespace Platform\Plugins\Trading\Src\Repositories\Interfaces;

use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;

interface InstrumentPeriodsInterface {
    public function create(array $instrument): InstrumentPeriods;

    public function find(int $id): ?InstrumentPeriods;

    public function findAll($filter, $select, $perPage);

    public function update(int $id, array $instrument): ?InstrumentPeriods;

    public function delete(int $id): bool;
}