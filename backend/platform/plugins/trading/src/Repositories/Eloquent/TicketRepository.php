<?php

namespace Platform\Plugins\Trading\Src\Repositories\Eloquent;

use Platform\Plugins\Trading\Src\Models\Ticket;
use Platform\Plugins\Trading\Src\Repositories\Interfaces\TicketInterface;
use Illuminate\Pagination\LengthAwarePaginator;

class TicketRepository implements TicketInterface
{
    public function create(array $data): Ticket
    {
        return Ticket::create($data);
    }

    public function find(string $id): ?Ticket
    {
        return Ticket::find($id);
    }

    public function findByUser(string $userId, array $filters = [], int $perPage = 15, ?int $page = null, ?array $select = null): LengthAwarePaginator
    {
        $query = Ticket::where('user_id', $userId)->orderByDesc('created_at');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (!empty($filters['market'])) {
            $query->where('market', $filters['market']);
        }
        if (!empty($filters['symbol'])) {
            $query->where('symbol', $filters['symbol']);
        }
        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }
        if (!empty($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        $allowedColumns = ['id', 'user_id', 'type', 'market', 'symbol', 'leverage', 'volume', 'price', 'status', 'profit', 'open', 'close', 'created_at', 'updated_at'];
        $columns = ['*'];
        if ($select !== null && $select !== []) {
            $filtered = array_values(array_filter(array_map('trim', $select)));
            $valid = array_intersect($filtered, $allowedColumns);
            if ($valid !== []) {
                $columns = array_unique(array_merge(['id'], $valid));
            }
        }

        return $query->paginate($perPage, $columns, 'page', $page);
    }

    public function update(string $id, array $data): ?Ticket
    {
        $ticket = Ticket::find($id);
        if ($ticket) {
            $ticket->update($data);
            return $ticket;
        }
        return null;
    }

    public function delete(string $id): bool
    {
        $ticket = Ticket::find($id);
        return $ticket ? (bool) $ticket->delete() : false;
    }
}
