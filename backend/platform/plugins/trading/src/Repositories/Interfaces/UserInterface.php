<?php
namespace Platform\Plugins\Trading\Src\Repositories\Interfaces;

use Platform\Plugins\Trading\Src\Models\Users;
use Illuminate\Pagination\LengthAwarePaginator;

interface UserInterface {
    public function create(array $user): Users;

    public function createWithHashedPassword(array $user): Users;

    public function find(string $id): ?Users;

    public function findByEmail(string $email): ?Users;

    public function findAll($filter, $select, $perPage): LengthAwarePaginator;

    public function update(string $id, array $user): ?Users;

    public function delete(string $id): bool;
}