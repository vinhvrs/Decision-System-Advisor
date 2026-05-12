<?php

namespace Platform\Plugins\Trading\Src\Http\Controllers;

use App\Services\PythonEngineTriggerService;
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
        $sector = $request->query('sector');
        $sector = is_string($sector) ? trim($sector) : null;
        if ($sector === '') {
            $sector = null;
        }

        return response()->json([
            'data' => $this->snapshotService->heatmapDaily($limit, $sector),
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
    public function dashboardDaily(Request $request)
    {
        $limit = $this->limit($request, 100);
        $chartBars = (int) $request->get('chart_bars', 90);
        $chartBars = max(2, min(500, $chartBars));

        $data = $this->snapshotService->dashboardDailyFromPythonRedis();
        if ($this->snapshotService->isDashboardDailyPayloadEmpty($data)) {
            $data = $this->snapshotService->dashboardDailyFallbackFromDatabase($limit, $chartBars);
        }

        if ($this->snapshotService->isDashboardDailyPayloadEmpty($data)) {
            return response()->json([
                'message' => 'No ranking data yet. Populate instrument_snapshot and instrument_data (e.g. ranking sync / python ingest), or warm Redis: python -m app.warm_up.warm_up',
            ], 404);
        }

        $lite = filter_var($request->query('lite', false), FILTER_VALIDATE_BOOL);
        if ($lite) {
            $data = $this->stripDashboardDailyHeavyAliases($data);
        }

        $etag = '"'.sha1(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)).'"';
        if ($request->headers->get('If-None-Match') === $etag) {
            return response('', 304, [
                'ETag' => $etag,
                'Cache-Control' => 'public, max-age=15, stale-while-revalidate=60',
                'Vary' => 'Accept, Authorization',
            ]);
        }

        PythonEngineTriggerService::requestDashboardWarmUpAfterResponse();

        return response()
            ->json(['data' => $data])
            ->header('ETag', $etag)
            ->header('Cache-Control', 'public, max-age=15, stale-while-revalidate=60')
            ->header('Vary', 'Accept, Authorization');
    }

    /**
     * Remove duplicate aliases from Python payload to cut transfer size.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    protected function stripDashboardDailyHeavyAliases(array $payload): array
    {
        if (! isset($payload['rows']) || ! is_array($payload['rows'])) {
            return $payload;
        }

        $payload['rows'] = array_map(function ($row) {
            if (! is_array($row)) {
                return $row;
            }
            unset($row['name'], $row['change'], $row['bias'], $row['suggestion'], $row['str'], $row['care']);
            return $row;
        }, $payload['rows']);

        if (isset($payload['ranking_board']) && is_array($payload['ranking_board'])) {
            $payload['ranking_board'] = $payload['rows'];
        }

        return $payload;
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