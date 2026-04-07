<?php

namespace Platform\Plugins\Trading\Src\Repositories\Interfaces;

use Platform\Plugins\Trading\Src\Models\Ticket;
use Illuminate\Pagination\LengthAwarePaginator;

interface TicketInterface
{
    public function create(array $data): Ticket;

    public function find(string $id): ?Ticket;

    /**
     * @param  array<string, mixed>  $filters  status, market, symbol, type, date_from, date_to
     * @param  array<string>|null  $select  Column names to select (null = all)
     */
    public function findByUser(string $userId, array $filters = [], int $perPage = 15, ?int $page = null, ?array $select = null): LengthAwarePaginator;

    public function update(string $id, array $data): ?Ticket;

    public function delete(string $id): bool;
}
