<?php
namespace Platform\Plugins\Trading\Src\Services;
use Illuminate\Support\Facades\Http;
use Platform\Plugins\Trading\Src\Models\StockAttribute;
use Platform\Plugins\Trading\Src\Models\Instruments;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\StockRepository;

class StockService
{
    protected StockRepository $stockRepository;

    public function __construct(StockRepository $stockRepository)
    {
        $this->stockRepository = $stockRepository;
    }
    /**
     * Calculate confidence score based on data consistency and analyst coverage
     */
    protected function confidenceScoreCalc(array $data): int
    {
        $score = 0;

        // Revenue consistency
        $spreadRevenue = $data['revenue_high'] - $data['revenue_low'];
        $spreadPct = $spreadRevenue / max($data['revenue_avg'], 1);

        $score += $spreadPct <= 0.02 ? 25 :
            ($spreadPct <= 0.05 ? 20 :
                ($spreadPct <= 0.08 ? 15 :
                    ($spreadPct <= 0.12 ? 10 : 5)));

        // EPS consistency
        $spreadEPS = $data['eps_high'] - $data['eps_low'];
        $spreadEPSPct = $spreadEPS / max($data['eps_avg'], 1);

        $score += $spreadEPSPct <= 0.03 ? 25 :
            ($spreadEPSPct <= 0.07 ? 20 :
                ($spreadEPSPct <= 0.10 ? 15 :
                    ($spreadEPSPct <= 0.15 ? 10 : 5)));

        // Analysts
        $analysts = min($data['num_analysts_revenue'], $data['num_analysts_eps']);
        $score += $analysts >= 15 ? 25 :
            ($analysts >= 10 ? 20 :
                ($analysts >= 7 ? 15 :
                    ($analysts >= 4 ? 10 : 5)));

        // Profit margin
        $profitMargin = $data['net_income_avg'] / max($data['revenue_avg'], 1);
        $score += $profitMargin >= 0.30 ? 25 :
            ($profitMargin >= 0.25 ? 20 :
                ($profitMargin >= 0.20 ? 15 :
                    ($profitMargin >= 0.15 ? 10 : 5)));

        return $score;
    }


    /**
     * Main API: calculate stock attribute for single symbol
     */
    public function calculate($symbol)
    {
        $symbol = strtoupper($symbol);
        $key = env('ALPHA_VANTAGE_API_KEY');
        if (!$key) {
            return response()->json(['error' => 'Missing AlphaVantage key'], 500);
        }

        $url = "https://www.alphavantage.co/query?function=EARNINGS&symbol={$symbol}&apikey={$key}";
        $response = Http::withOptions([
            'verify' => false
        ])->get($url);

        if (!$response->successful() || !isset($response['quarterlyEarnings'][0])) {
            return response()->json(['error' => 'No data found'], 404);
        }

        $latest = $response['quarterlyEarnings'][0];

        /**
         * EPS calculations
         */
        $reported = (float) ($latest['reportedEPS'] ?? 0);

        // estimatedEPS may be "None"
        $estimated = ($latest['estimatedEPS'] ?? "None") !== "None"
            ? (float) $latest['estimatedEPS']
            : ($reported * 0.95);

        $eps_low = min($reported, $estimated);
        $eps_high = max($reported, $estimated);
        $eps_avg = ($reported + $estimated) / 2;

        /**
         * Estimate revenue using EPS spread ratio
         */
        $spreadPct = abs($reported - $estimated) / max($eps_avg, 1);

        $revenue_avg = $eps_avg * 100;   // simple model
        $revenue_low = $revenue_avg * (1 - $spreadPct);
        $revenue_high = $revenue_avg * (1 + $spreadPct);

        /**
         * Net Income estimation (EPS * shares outstanding)
         */
        $shares = 16_000_000_000;

        $net_income_low = $eps_low * $shares;
        $net_income_high = $eps_high * $shares;
        $net_income_avg = $eps_avg * $shares;

        /**
         * EBITDA & EBIT estimation ratios
         */
        $ebitda_low = $net_income_low * 0.30;
        $ebitda_high = $net_income_high * 0.30;
        $ebitda_avg = $net_income_avg * 0.30;

        $ebit_low = $net_income_low * 0.25;
        $ebit_high = $net_income_high * 0.25;
        $ebit_avg = $net_income_avg * 0.25;

        /**
         * SGA expense heuristic
         */
        $sga_low = $revenue_low * 0.12;
        $sga_high = $revenue_high * 0.12;
        $sga_avg = $revenue_avg * 0.12;

        /**
         * Analyst count heuristic
         */
        $analysts = ($latest['estimatedEPS'] ?? "None") !== "None"
            ? rand(10, 25)
            : rand(0, 5);

        /**
         * Prepare data in EXACT fillable format
         */
        $data = [
            'date' => now()->toDateString(),
            'instrument_id' => Instruments::where('symbol', $symbol)->value('id'),

            'revenue_low' => $revenue_low,
            'revenue_high' => $revenue_high,
            'revenue_avg' => $revenue_avg,

            'ebitda_low' => $ebitda_low,
            'ebitda_high' => $ebitda_high,
            'ebitda_avg' => $ebitda_avg,

            'ebit_low' => $ebit_low,
            'ebit_high' => $ebit_high,
            'ebit_avg' => $ebit_avg,

            'net_income_low' => $net_income_low,
            'net_income_high' => $net_income_high,
            'net_income_avg' => $net_income_avg,

            'sga_expense_low' => $sga_low,
            'sga_expense_high' => $sga_high,
            'sga_expense_avg' => $sga_avg,

            'eps_low' => $eps_low,
            'eps_high' => $eps_high,
            'eps_avg' => $eps_avg,

            'num_analysts_revenue' => $analysts,
            'num_analysts_eps' => $analysts,
        ];

        /**
         * Calculate confidence score
         */
        $confidence = $this->confidenceScoreCalc($data);
        $data['confidence_score'] = $confidence;

        /**
         * Recommendation based on confidence score
         */
        if ($confidence <= 39)
            $data['recommendation'] = 'Sell';
        else if ($confidence <= 59)
            $data['recommendation'] = 'Hold';
        else if ($confidence <= 79)
            $data['recommendation'] = 'Buy';
        else
            $data['recommendation'] = 'Buy';

        /**
         * Convert payload
         */
        $record = [
            'instrument_id' => $data['instrument_id'],
            'date' => $data['date'],
            'details' => $data
        ];
        return response()->json([
            'symbol' => $symbol,
            'score' => $confidence,
            'recommendation' => $data['recommendation'],
            'data' => $record,
        ]);
    }

    /**
     * RSI (Wilder) for a symbol + period
     */
    public function RSI_Calculation(string $symbol, string $period = 'daily', int $n = 14)
    {
        $closes = $this->getClosesBySymbolPeriod($symbol, $period, 300);

        if ($closes->count() < $n + 2) {
            return response()->json(['error' => 'Not enough data for RSI'], 422);
        }

        $series = $closes->pluck('close')->map(fn($v) => (float) $v)->values()->all();
        $rsiSeries = $this->computeRSI($series, $n);

        $lastIdx = count($series) - 1;

        return response()->json([
            'symbol' => strtoupper($symbol),
            'period' => $period,
            'rsi_period' => $n,
            'rsi' => round((float) ($rsiSeries[$lastIdx] ?? 0), 2),
        ]);
    }

    /**
     * MACD (12,26,9 default) for a symbol + period
     */
    public function MACD_Calculation(
        string $symbol,
        string $period = 'daily',
        int $fast = 12,
        int $slow = 26,
        int $signal = 9
    ) {
        $closes = $this->getClosesBySymbolPeriod($symbol, $period, 400);

        if ($closes->count() < ($slow + $signal + 5)) {
            return response()->json(['error' => 'Not enough data for MACD'], 422);
        }

        $series = $closes->pluck('close')->map(fn($v) => (float) $v)->values()->all();
        [$macdLine, $signalLine, $hist] = $this->computeMACD($series, $fast, $slow, $signal);

        $t = count($series) - 1;
        $cross = $this->detectMacdCrossover($macdLine, $signalLine, $t);

        return response()->json([
            'symbol' => strtoupper($symbol),
            'period' => $period,
            'params' => ['fast' => $fast, 'slow' => $slow, 'signal' => $signal],
            'macd' => round((float) $macdLine[$t], 6),
            'signal_line' => round((float) $signalLine[$t], 6),
            'histogram' => round((float) $hist[$t], 6),
            'crossover' => $cross, // bullish | bearish | none
        ]);
    }

    /**
     * Combine RSI + MACD to output BUY / SELL / HOLD
     * Rule:
     *  - BUY  if RSI <= 30 and MACD bullish crossover
     *  - SELL if RSI >= 70 and MACD bearish crossover
     *  - otherwise HOLD
     */
    public function indicatorSummary(string $symbol, string $period = 'daily')
    {
        $symbol = strtoupper($symbol);

        $closes = $this->getClosesBySymbolPeriod($symbol, $period, 500);
        if ($closes->count() < 60) {
            return response()->json(['error' => 'Not enough data for RSI + MACD summary'], 422);
        }

        $series = $closes->pluck('close')->map(fn($v) => (float) $v)->values()->all();
        $t = count($series) - 1;

        // RSI
        $rsiPeriod = 14;
        $rsiSeries = $this->computeRSI($series, $rsiPeriod);
        $rsi = (float) ($rsiSeries[$t] ?? 0);

        // MACD
        $fast = 12;
        $slow = 26;
        $sigN = 9;
        [$macdLine, $signalLine, $hist] = $this->computeMACD($series, $fast, $slow, $sigN);
        $macd = (float) $macdLine[$t];
        $sig = (float) $signalLine[$t];
        $his = (float) $hist[$t];

        $crossover = $this->detectMacdCrossover($macdLine, $signalLine, $t);

        // Decision
        $recommendation = 'hold';
        if ($rsi <= 30 && $crossover === 'bullish') {
            $recommendation = 'buy';
        } elseif ($rsi >= 70 && $crossover === 'bearish') {
            $recommendation = 'sell';
        }

        // Confidence heuristic (0..1)
        $confidence_score = $this->confidenceFromIndicators($recommendation, $rsi, $his, $hist);
        $last = $closes->last();

        $payloadResult = [
            'date' => now()->toDateString(),
            'instrument_id' => Instruments::where('symbol', $symbol)->value('id'),
            'revenue_low' => 0, 
            'revenue_high' => 0, 
            'revenue_avg' => 0,
            'ebitda_low' => 0, 
            'ebitda_high' => 0, 
            'ebitda_avg' => 0,
            'ebit_low' => 0, 
            'ebit_high' => 0, 
            'ebit_avg' => 0,
            'net_income_low' => 0, 
            'net_income_high' => 0, 
            'net_income_avg' => 0,
            'sga_expense_low' => 0, 
            'sga_expense_high' => 0, 
            'sga_expense_avg' => 0,
            'eps_low' => 0, 
            'eps_high' => 0, 
            'eps_avg' => 0,
            'num_analysts_revenue' => 0, 
            'num_analysts_eps' => 0,
            'confidence_score' => round($confidence_score * 100, 2),
            'recommendation' => ucfirst($recommendation)
        ];

        $this->stockRepository->createOrUpdate($payloadResult);

        return response()->json([
            'symbol' => $symbol,
            'period' => $period,
            'recommendation' => $recommendation, // buy|sell|hold
            'confidence_score' => round($confidence_score * 100, 2),

            'rsi' => round($rsi, 2),
            'macd' => round($macd, 6),
            'signal_line' => round($sig, 6),
            'histogram' => round($his, 6),
            'crossover' => $crossover,

            'meta' => [
                'rsi_period' => $rsiPeriod,
                'macd_params' => ['fast' => $fast, 'slow' => $slow, 'signal' => $sigN],
                'thresholds' => ['rsi_low' => 30, 'rsi_high' => 70],
                'last_timestamp' => $last?->timestamp,
            ],
        ]);
    }

    // =========================
    // Data access (DB -> closes)
    // =========================

    /**
     * Get closes by symbol + period directly from DB tables:
     * instruments -> instrument_periods -> instrument_data
     */
    protected function getClosesBySymbolPeriod(string $symbol, string $period, int $limit = 500): Collection
    {
         $rows = DB::table('instrument_data')
        ->join('instrument_periods', 'instrument_data.instrument_period_id', '=', 'instrument_periods.id')
        ->join('instruments', 'instrument_periods.instrument_id', '=', 'instruments.id')
        ->where('instruments.symbol', strtoupper($symbol))
        ->where('instrument_periods.period', $period)
        ->orderByDesc('instrument_data.timestamps')
        ->limit($limit)
        ->get([
            'instrument_data.timestamps as timestamp',
            'instrument_data.close as close',
        ]);

        return $rows->reverse()->values();
    }

    // =========================
    // Indicator core
    // =========================

    protected function computeRSI(array $closes, int $n): array
    {
        $T = count($closes);
        $rsi = array_fill(0, $T, null);
        if ($T <= $n)
            return $rsi;

        $gains = [];
        $losses = [];
        for ($t = 1; $t < $T; $t++) {
            $delta = $closes[$t] - $closes[$t - 1];
            $gains[$t] = max($delta, 0.0);
            $losses[$t] = max(-$delta, 0.0);
        }

        $avgGain = array_sum(array_slice($gains, 1, $n)) / $n;
        $avgLoss = array_sum(array_slice($losses, 1, $n)) / $n;

        for ($t = $n; $t < $T; $t++) {
            if ($t > $n) {
                $avgGain = (($avgGain * ($n - 1)) + ($gains[$t] ?? 0.0)) / $n;
                $avgLoss = (($avgLoss * ($n - 1)) + ($losses[$t] ?? 0.0)) / $n;
            }

            if ($avgLoss == 0.0)
                $rsi[$t] = 100.0;
            else {
                $rs = $avgGain / $avgLoss;
                $rsi[$t] = 100.0 - (100.0 / (1.0 + $rs));
            }
        }

        return $rsi;
    }

    protected function computeEMA(array $series, int $n): array
    {
        $T = count($series);
        $ema = array_fill(0, $T, null);
        if ($T === 0)
            return $ema;

        $k = 2.0 / ($n + 1.0);
        $ema[0] = (float) $series[0];

        for ($t = 1; $t < $T; $t++) {
            $ema[$t] = ($k * (float) $series[$t]) + ((1.0 - $k) * (float) $ema[$t - 1]);
        }

        return $ema;
    }

    protected function computeMACD(array $closes, int $fast, int $slow, int $signal): array
    {
        $emaFast = $this->computeEMA($closes, $fast);
        $emaSlow = $this->computeEMA($closes, $slow);

        $T = count($closes);
        $macdLine = array_fill(0, $T, null);
        for ($t = 0; $t < $T; $t++) {
            $macdLine[$t] = (float) $emaFast[$t] - (float) $emaSlow[$t];
        }

        $signalLine = $this->computeEMA($macdLine, $signal);

        $hist = array_fill(0, $T, null);
        for ($t = 0; $t < $T; $t++) {
            $hist[$t] = (float) $macdLine[$t] - (float) $signalLine[$t];
        }

        return [$macdLine, $signalLine, $hist];
    }

    protected function detectMacdCrossover(array $macdLine, array $signalLine, int $t): string
    {
        if ($t < 1)
            return 'none';

        $m0 = (float) $macdLine[$t - 1];
        $s0 = (float) $signalLine[$t - 1];
        $m1 = (float) $macdLine[$t];
        $s1 = (float) $signalLine[$t];

        if ($m0 <= $s0 && $m1 > $s1)
            return 'bullish';
        if ($m0 >= $s0 && $m1 < $s1)
            return 'bearish';
        return 'none';
    }

    protected function confidenceFromIndicators(string $advice, float $rsi, float $histNow, array $histSeries): float
    {
        // RSI proximity to extremes (0..1)
        $distToLow = abs($rsi - 30.0);
        $distToHigh = abs($rsi - 70.0);
        $closest = min($distToLow, $distToHigh);

        // closest=0 => at extreme => 1
        // closest>=20 => far => 0
        $rsiStrength = max(0.0, min(1.0, (20.0 - $closest) / 20.0));

        // Histogram strength normalized by recent max abs (0..1)
        $recent = array_slice(array_map(fn($x) => (float) ($x ?? 0.0), $histSeries), -50);
        $maxAbs = max(1e-9, max(array_map(fn($x) => abs($x), $recent)));
        $histStrength = max(0.0, min(1.0, abs($histNow) / $maxAbs));

        // Combine (still valid even when HOLD)
        return (0.6 * $rsiStrength) + (0.4 * $histStrength);
    }

}