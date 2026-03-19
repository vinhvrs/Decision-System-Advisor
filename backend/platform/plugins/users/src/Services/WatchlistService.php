<?php

namespace Platform\Plugins\Users\Src\Services;

use Illuminate\Support\Collection;
use Platform\Plugins\Users\Src\Models\Watchlist;
use Platform\Plugins\Trading\Src\Models\Ticket;

class WatchlistService
{
    /**
     * Get watchlist items for user with positions (tickets) joined.
     * Each item includes open positions from tickets table for that symbol.
     */
    public function getByUserWithPositions(string $userId): Collection
    {
        $items = Watchlist::where('user_id', $userId)
            ->orderBy('symbol')
            ->get();

        $positions = Ticket::where('user_id', $userId)
            ->where('status', 'open')
            ->get()
            ->groupBy('symbol');

        return $items->map(function (Watchlist $item) use ($positions) {
            $data = $item->toArray();
            $data['positions'] = ($positions->get($item->symbol) ?? collect())->values()->toArray();
            return $data;
        });
    }

    /**
     * Get watchlist items for user (without positions).
     */
    public function getByUser(string $userId): Collection
    {
        return Watchlist::where('user_id', $userId)
            ->orderBy('symbol')
            ->get();
    }

    public function add(string $userId, string $symbol): Watchlist
    {
        return Watchlist::firstOrCreate(
            ['user_id' => $userId, 'symbol' => $symbol],
            ['user_id' => $userId, 'symbol' => $symbol]
        );
    }

    public function remove(string $userId, string $symbol): bool
    {
        $deleted = Watchlist::where('user_id', $userId)
            ->where('symbol', $symbol)
            ->delete();

        return $deleted > 0;
    }

    public function find(string $id): ?Watchlist
    {
        return Watchlist::find($id);
    }
}
