<?php

namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Services\SnapshotService;

class RankingController extends Controller
{
    protected SnapshotService $snapshotService;

    public function __construct(SnapshotService $snapshotService)
    {
        $this->snapshotService = $snapshotService;
    }

    protected function limit(Request $request, int $default = 100): int
    {
        $limit = (int) $request->get('limit', $default);

        if ($limit <= 0) {
            $limit = $default;
        }

        return min($limit, 500);
    }

    protected function parseOrderBy(Request $request, string $default = 'liquidity'): string
    {
        $orderBy = (string) $request->get('order_by', $default);

        $allowed = ['market_cap', 'liquidity', 'change_pct', 'volume', 'price'];

        return in_array($orderBy, $allowed, true) ? $orderBy : $default;
    }

    public function companyProfile($symbol)
    {
        if (!$symbol) {
            return response()->json(['error' => 'Symbol is required'], 400);
        }
        return response()->json([
            'data' => $this->snapshotService->companyProfile($symbol)
        ]);
    }

    public function topLiquidity(Request $request)
    {
        $limit = $this->limit($request, 100);

        return response()->json([
            'data' => $this->snapshotService->topLiquidity($limit),
        ]);
    }

    public function bottomLiquidity(Request $request)
    {
        $limit = $this->limit($request, 100);

        return response()->json([
            'data' => $this->snapshotService->bottomLiquidity($limit),
        ]);
    }

    public function topGainers(Request $request)
    {
        $limit = $this->limit($request, 100);

        return response()->json([
            'data' => $this->snapshotService->topGainers($limit),
        ]);
    }

    public function topLosers(Request $request)
    {
        $limit = $this->limit($request, 100);

        return response()->json([
            'data' => $this->snapshotService->topLosers($limit),
        ]);
    }

    public function topCompanies(Request $request)
    {
        $limit = $this->limit($request, 100);
        $orderBy = $this->parseOrderBy($request, 'liquidity');

        return response()->json([
            'data' => $this->snapshotService->topCompanies($limit, $orderBy),
        ]);
    }

    public function topMarketCap(Request $request)
    {
        $limit = $this->limit($request, 100);

        return response()->json([
            'data' => $this->snapshotService->topMarketCap($limit),
        ]);
    }

    public function heatmapDaily(Request $request)
    {
        $limit = $this->limit($request, 100);

        return response()->json([
            'data' => $this->snapshotService->heatmapDaily($limit),
        ]);
    }

    /**
     * Simple market + community snapshot for beginner-oriented pages.
     */
    public function beginnerOverview(string $symbol)
    {
        try {
            $data = $this->snapshotService->beginnerOverview($symbol);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'Unable to load beginner overview for this symbol.'], 500);
        }

        if ($data === null) {
            return response()->json(['message' => 'No snapshot for this symbol yet.'], 404);
        }

        return response()->json(['data' => $data]);
    }

    /**
     * Ranked beginner “radar” board: six 1–5 scores, sorted by count of scores ≥ 4.
     */
    public function beginnerBoard(Request $request)
    {
        $limit = $this->limit($request, 50);

        return response()->json([
            'data' => $this->snapshotService->beginnerRankingBoard($limit),
        ]);
    }
}