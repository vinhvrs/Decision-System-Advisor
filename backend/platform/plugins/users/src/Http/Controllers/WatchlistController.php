<?php

namespace Platform\Plugins\Users\Src\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Platform\Plugins\Users\Src\Services\WatchlistService;

class WatchlistController extends Controller
{
    public function __construct(
        protected WatchlistService $watchlistService
    ) {
    }

    /**
     * List watchlist items for authenticated user.
     * Query param: with_positions=true to include open positions from tickets.
     */
    public function index(Request $request)
    {
        $userId = $request->user()->id;
        $withPositions = $request->boolean('with_positions', true);

        $items = $withPositions
            ? $this->watchlistService->getByUserWithPositions($userId)
            : $this->watchlistService->getByUser($userId);

        return response()->json(['data' => $items]);
    }

    /**
     * Add symbol to watchlist.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'symbol' => 'required|string|max:32',
        ]);

        $item = $this->watchlistService->add($request->user()->id, $validated['symbol']);
        return response()->json($item, 201);
    }

    /**
     * Remove symbol from watchlist.
     */
    public function destroy(Request $request, string $symbol)
    {
        $removed = $this->watchlistService->remove($request->user()->id, $symbol);
        if (!$removed) {
            return response()->json(['message' => 'Watchlist item not found'], 404);
        }
        return response()->json(['deleted' => true]);
    }
}
