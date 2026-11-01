<?php
namespace Platform\Plugins\Trading\Src\Repositories\Interfaces;
use Platform\Plugins\Trading\Src\Models\News;
use Illuminate\Pagination\LengthAwarePaginator;

interface NewsInterface {
    public function create(array $news): News;

    public function find(string $id): ?News;

    public function findAll($filter, $select, $perPage): LengthAwarePaginator;

    public function delete(string $id): bool;
}