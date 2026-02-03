<?php
namespace Platform\Plugins\Trading\Src\Services;

use Platform\Plugins\Trading\Src\Repositories\Eloquent\StockRepository;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\IndicatorMathRepository;

class AnalysistService
{
    protected StockRepository $stockRepository;
    protected IndicatorMathRepository $indicatorMath;

    public function __construct(StockRepository $stockRepository, IndicatorMathRepository $indicatorMath)
    {
        $this->stockRepository = $stockRepository;
        $this->indicatorMath = $indicatorMath;
    }

    public function Indicator_Summary(string $symbol, string $period = 'daily')
    {
        $sma = $this->Indicator_SMA($symbol, $period, 14)->getData(true);
        $ema = $this->Indicator_EMA($symbol, $period, 14)->getData(true);
        $rsi = $this->Indicator_RSI($symbol, $period, 14)->getData(true);
        $macd = $this->Indicator_MACD($symbol, $period, 12, 26, 9)->getData(true);
        $rsi = $this->Indicator_RSI($symbol, $period, 14)->getData(true);
        $stochastic = $this->Indicator_StochasticOscillator($symbol, $period, 14, 3)->getData(true);
        $boillinger = $this->Indicator_BollingerBands($symbol, $period, 2.0, 20)->getData(true);
        $price = $this->stockRepository->getCurrentPrice($symbol, $period);
        $summary = [
            'symbol' => strtoupper($symbol),
            'period' => $period,
            'indicators' => [
                'sma' => $sma,
                'ema' => $ema,
                'rsi' => $rsi,
                'macd' => $macd,
                'stochastic' => $stochastic,
                'bollinger_bands' => $boillinger,
            ],
            'price' => $price,
        ];
        return response()->json($summary);
    }

    public function Indicator_SMA(string $symbol, string $period = 'daily', int $n = 14)
    {
        $closes = $this->indicatorMath->getLastCandles($symbol, $period, 300);

        if ($closes->count() < $n + 2) {
            return response()->json(['error' => 'Not enough data for SMA'], 422);
        }

        $series = $closes->pluck('close')->map(fn($v) => (float) $v)->values()->all();
        $smaSeries = $this->indicatorMath->calculateSMA(data: $series, period: $n);

        // lấy index cuối của chính smaSeries
        $lastIdx = count($smaSeries) - 1;

        return response()->json([
            'symbol' => strtoupper($symbol),
            'period' => $period,
            'sma_period' => $n,
            'sma' => round((float) ($smaSeries[$lastIdx] ?? 0), 2),
        ]);

    }

    public function Indicator_EMA(string $symbol, string $period = 'daily', int $n = 14)
    {
        $closes = $this->indicatorMath->getLastCandles($symbol, $period, 300);

        if ($closes->count() < $n + 2) {
            return response()->json(['error' => 'Not enough data for EMA'], 422);
        }

        $series = $closes->pluck('close')->map(fn($v) => (float) $v)->values()->all();
        $emaSeries = $this->indicatorMath->calculateEMA($series, $n);

        $lastIdx = count($series) - 1;

        return response()->json([
            'symbol' => strtoupper($symbol),
            'period' => $period,
            'ema_period' => $n,
            'ema' => round((float) ($emaSeries[$lastIdx] ?? 0), 2),
        ]);
    }

    /**
     * RSI (Wilder) for a symbol + period
     */
    public function Indicator_RSI(string $symbol, string $period = 'daily', int $n = 14)
    {
        $closes = $this->indicatorMath->getLastCandles($symbol, $period, 300);

        if ($closes->count() < $n + 2) {
            return response()->json(['error' => 'Not enough data for RSI'], 422);
        }

        $series = $closes->pluck('close')->map(fn($v) => (float) $v)->values()->all();
        $rsiSeries = $this->indicatorMath->calculateRSI($series, $n);

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
    public function Indicator_MACD(
        string $symbol,
        string $period = 'daily',
        int $fast = 12,
        int $slow = 26,
        int $signal = 9
    ) {
        $closes = $this->indicatorMath->getLastCandles($symbol, $period, 400);

        if ($closes->count() < ($slow + $signal + 5)) {
            return response()->json(['error' => 'Not enough data for MACD'], 422);
        }

        $series = $closes->pluck('close')->map(fn($v) => (float) $v)->values()->all();
        [$macdLine, $signalLine, $hist] = $this->indicatorMath->calculateMACD($series, $fast, $slow, $signal);

        $t = count($series) - 1;
        $cross = $this->indicatorMath->detectCrossovers($macdLine, $signalLine);

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

    public function Indicator_BollingerBands(string $symbol, string $period = 'daily', float $stdDevMultiplier = 2.0, int $n = 20)
    {
        $closes = $this->indicatorMath->getLastCandles($symbol, $period, 300);

        if ($closes->count() < $n + 5) {
            return response()->json(['error' => 'Not enough data for Bollinger Bands'], 422);
        }

        $series = $closes->pluck('close')->map(fn($v) => (float) $v)->values()->all();
        [$lowerBand, $middleBand, $upperBand] = $this->indicatorMath->calculateBollingerBands($series, $n, $stdDevMultiplier);

        // last index của bands (vì bands có thể ngắn hơn series)
        $bbLastIdx = min(count($lowerBand), count($middleBand), count($upperBand)) - 1;

        return response()->json([
            'symbol' => strtoupper($symbol),
            'timeframe' => $period,
            'bb_period' => $n,
            'std_dev_multiplier' => $stdDevMultiplier,
            'lower_band' => round((float) ($lowerBand[$bbLastIdx] ?? 0), 2),
            'middle_band' => round((float) ($middleBand[$bbLastIdx] ?? 0), 2),
            'upper_band' => round((float) ($upperBand[$bbLastIdx] ?? 0), 2),
        ]);
    }

    public function Indicator_StochasticOscillator(string $symbol, string $period = 'daily', int $kPeriod = 14, int $dPeriod = 3)
    {
        $candles = $this->indicatorMath->getLastCandles(symbol: $symbol, period: $period, limit: 300);

        $series = $candles->map(fn($c) => [
            'high' => (float) $c->high,
            'low' => (float) $c->low,
            'close' => (float) $c->close,
        ])->values()->all();

        [$kSeries, $dSeries] = $this->indicatorMath->calculateStochasticOscillator(
            data: $series,
            kPeriod: $kPeriod,
            dPeriod: $dPeriod
        );


        $kLast = $this->indicatorMath->lastNonNull($kSeries);
        $dLast = $this->indicatorMath->lastNonNull($dSeries);


        $lastIdx = count($series) - 1;

        return response()->json([
            'symbol' => strtoupper($symbol),
            'period' => $period,
            'k_period' => $kPeriod,
            'd_period' => $dPeriod,
            'percent_k' => round((float) ($kLast ?? 0), 2),
            'percent_d' => round((float) ($dLast ?? 0), 2),
        ]);
    }
}