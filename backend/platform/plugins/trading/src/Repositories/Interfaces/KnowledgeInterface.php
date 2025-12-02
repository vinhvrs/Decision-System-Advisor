<?php
namespace Platform\Plugins\Trading\Src\Repositories\Interfaces;
use Platform\Plugins\Trading\Src\Models\Knowledge;
use Illuminate\Pagination\LengthAwarePaginator;

interface KnowledgeInterface {
    public function create(array $knowledge): Knowledge;

    public function find(string $id): ?Knowledge;

    public function findAll($filter, $select, $perPage): LengthAwarePaginator;

    public function update(string $id, array $knowledge): ?Knowledge;

    public function delete(string $id): bool;
}