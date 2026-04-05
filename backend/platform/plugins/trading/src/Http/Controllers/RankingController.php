<?php

namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\InstrumentDataRepository;
use Platform\Plugins\Trading\Src\Services\SnapshotService;

class RankingController extends Controller
{
    protected SnapshotService $snapshotService;

    protected InstrumentDataRepository $instrumentDataRepository;

    public function __construct(SnapshotService $snapshotService, InstrumentDataRepository $instrumentDataRepository)
    {
        $this->snapshotService = $snapshotService;
        $this->instrumentDataRepository = $instrumentDataRepository;
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
     * One response: beginner overview + OHLCV bars for the symbol (reduces round trips for /test UI).
     */
    public function beginnerPage(Request $request, string $symbol)
    {
        $period = strtolower((string) $request->get('period', 'daily'));
        if (! in_array($period, ['daily', 'yearly'], true)) {
            $period = 'daily';
        }
        $candleLimit = (int) $request->get('candles_limit', $period === 'yearly' ? 80 : 400);
        $candleLimit = max(1, min($candleLimit, 2000));

        try {
            $overview = $this->snapshotService->beginnerOverview($symbol);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'Unable to load beginner overview for this symbol.'], 500);
        }

        if ($overview === null) {
            return response()->json(['message' => 'No snapshot for this symbol yet.'], 404);
        }

        $candles = $this->instrumentDataRepository->getRecentBarsForSymbol($symbol, $period, $candleLimit);

        return response()->json([
            'data' => [
                'overview' => $overview,
                'candles' => $candles,
            ],
        ]);
    }

    /**
     * Ranked beginner “radar” board: six 1–5 scores in payload; sorted by strong_count over five spokes (Price excluded).
     */
    public function beginnerBoard(Request $request)
    {
        $limit = $this->limit($request, 20);

        return response()->json([
            'data' => $this->snapshotService->beginnerRankingBoard($limit),
        ]);
    }

    /**
     * Redis `dashboard:daily` payload (python_engine warm_up) — same overall shape as beginner board.
     */
    public function dashboardDaily()
    {
        $data = $this->snapshotService->dashboardDailyFromPythonRedis();

        if ($data === null) {
            return response()->json([
                'message' => 'Dashboard daily cache is empty. Run: python -m app.warm_up.warm_up',
            ], 404);
        }

        return response()->json(['data' => $data]);
    }

    /**
     * Same 1–5 radar + F&G as the beginner homepage board, for one symbol (quintiles vs volume-ranked pool).
     */
    public function beginnerRadar(Request $request, string $symbol)
    {
        $pool = (int) $request->get('pool_limit', 100);
        $pool = max(20, min(500, $pool));

        try {
            $data = $this->snapshotService->beginnerRadarForSymbol($symbol, $pool);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'Unable to load beginner radar for this symbol.'], 500);
        }

        if ($data === null) {
            return response()->json(['message' => 'No snapshot for this symbol yet.'], 404);
        }

        return response()->json(['data' => $data]);
    }

    /**
     * Top symbols by snapshot volume (cached server-side ~3h). For “most active” side lists.
     */
    public function topByVolume(Request $request)
    {
        $limit = min($this->limit($request, 20), 100);

        return response()->json([
            'data' => $this->snapshotService->topSymbolsByVolume($limit),
        ]);
    }
}