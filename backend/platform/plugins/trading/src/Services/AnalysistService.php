<?php
namespace Platform\Plugins\Trading\Src\Services;

use Illuminate\Http\JsonResponse;
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

    public function indicatorSummaryData(string $symbol, string $period = 'daily'): array
    {
        $sma = $this->indicatorSmaData($symbol, $period, 14);
        $ema = $this->indicatorEmaData($symbol, $period, 14);
        $rsi = $this->indicatorRsiData($symbol, $period, 14);
        $macd = $this->indicatorMacdData($symbol, $period, 12, 26, 9);
        $stochastic = $this->indicatorStochasticOscillatorData($symbol, $period, 14, 3);
        $bollinger = $this->indicatorBollingerBandsData($symbol, $period, 2.0, 20);
        $price = $this->stockRepository->getCurrentPrice($symbol, $period);
        return [
            'symbol' => strtoupper($symbol),
            'period' => $period,
            'indicators' => [
                'sma' => $sma,
                'ema' => $ema,
                'rsi' => $rsi,
                'macd' => $macd,
                'stochastic' => $stochastic,
                'bollinger_bands' => $bollinger,
            ],
            'price' => $price,
        ];
    }

    public function indicatorSmaData(string $symbol, string $period = 'daily', int $n = 14): array
    {
        $closes = $this->indicatorMath->getLastCandles($symbol, $period, 300);
        if ($closes->count() < $n + 2) {
            return ['error' => 'Not enough data for SMA'];
        }
        $series = $closes->pluck('close')->map(fn($v) => (float) $v)->values()->all();
        $smaSeries = $this->indicatorMath->calculateSMA(data: $series, period: $n);
        $lastIdx = count($smaSeries) - 1;
        return [
            'symbol' => strtoupper($symbol),
            'period' => $period,
            'sma_period' => $n,
            'sma' => round((float) ($smaSeries[$lastIdx] ?? 0), 2),
        ];
    }

    public function indicatorEmaData(string $symbol, string $period = 'daily', int $n = 14): array
    {
        $closes = $this->indicatorMath->getLastCandles($symbol, $period, 300);
        if ($closes->count() < $n + 2) {
            return ['error' => 'Not enough data for EMA'];
        }
        $series = $closes->pluck('close')->map(fn($v) => (float) $v)->values()->all();
        $emaSeries = $this->indicatorMath->calculateEMA($series, $n);
        $lastIdx = count($series) - 1;
        return [
            'symbol' => strtoupper($symbol),
            'period' => $period,
            'ema_period' => $n,
            'ema' => round((float) ($emaSeries[$lastIdx] ?? 0), 2),
        ];
    }

    public function indicatorRsiData(string $symbol, string $period = 'daily', int $n = 14): array
    {
        $closes = $this->indicatorMath->getLastCandles($symbol, $period, 300);
        if ($closes->count() < $n + 2) {
            return ['error' => 'Not enough data for RSI'];
        }
        $series = $closes->pluck('close')->map(fn($v) => (float) $v)->values()->all();
        $rsiSeries = $this->indicatorMath->calculateRSI($series, $n);
        $lastIdx = count($series) - 1;
        return [
            'symbol' => strtoupper($symbol),
            'period' => $period,
            'rsi_period' => $n,
            'rsi' => round((float) ($rsiSeries[$lastIdx] ?? 0), 2),
        ];
    }

    public function indicatorMacdData(
        string $symbol,
        string $period = 'daily',
        int $fast = 12,
        int $slow = 26,
        int $signal = 9
    ): array {
        $closes = $this->indicatorMath->getLastCandles($symbol, $period, 400);
        if ($closes->count() < ($slow + $signal + 5)) {
            return ['error' => 'Not enough data for MACD'];
        }
        $series = $closes->pluck('close')->map(fn($v) => (float) $v)->values()->all();
        [$macdLine, $signalLine, $hist] = $this->indicatorMath->calculateMACD($series, $fast, $slow, $signal);
        $t = count($series) - 1;
        $cross = $this->indicatorMath->detectCrossovers($macdLine, $signalLine);
        return [
            'symbol' => strtoupper($symbol),
            'period' => $period,
            'params' => ['fast' => $fast, 'slow' => $slow, 'signal' => $signal],
            'macd' => round((float) $macdLine[$t], 6),
            'signal_line' => round((float) $signalLine[$t], 6),
            'histogram' => round((float) $hist[$t], 6),
            'crossover' => $cross,
        ];
    }

    public function indicatorBollingerBandsData(string $symbol, string $period = 'daily', float $stdDevMultiplier = 2.0, int $n = 20): array
    {
        $closes = $this->indicatorMath->getLastCandles($symbol, $period, 300);
        if ($closes->count() < $n + 5) {
            return ['error' => 'Not enough data for Bollinger Bands'];
        }
        $series = $closes->pluck('close')->map(fn($v) => (float) $v)->values()->all();
        [$lowerBand, $middleBand, $upperBand] = $this->indicatorMath->calculateBollingerBands($series, $n, $stdDevMultiplier);
        $bbLastIdx = min(count($lowerBand), count($middleBand), count($upperBand)) - 1;
        return [
            'symbol' => strtoupper($symbol),
            'timeframe' => $period,
            'bb_period' => $n,
            'std_dev_multiplier' => $stdDevMultiplier,
            'lower_band' => round((float) ($lowerBand[$bbLastIdx] ?? 0), 2),
            'middle_band' => round((float) ($middleBand[$bbLastIdx] ?? 0), 2),
            'upper_band' => round((float) ($upperBand[$bbLastIdx] ?? 0), 2),
        ];
    }

    public function indicatorStochasticOscillatorData(string $symbol, string $period = 'daily', int $kPeriod = 14, int $dPeriod = 3): array
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
        return [
            'symbol' => strtoupper($symbol),
            'period' => $period,
            'k_period' => $kPeriod,
            'd_period' => $dPeriod,
            'percent_k' => round((float) ($kLast ?? 0), 2),
            'percent_d' => round((float) ($dLast ?? 0), 2),
        ];
    }

    public function Indicator_Summary(string $symbol, string $period = 'daily'): JsonResponse
    {
        return response()->json($this->indicatorSummaryData($symbol, $period));
    }

    public function Indicator_SMA(string $symbol, string $period = 'daily', int $n = 14): JsonResponse
    {
        return $this->toJsonResponse($this->indicatorSmaData($symbol, $period, $n));
    }

    public function Indicator_EMA(string $symbol, string $period = 'daily', int $n = 14): JsonResponse
    {
        return $this->toJsonResponse($this->indicatorEmaData($symbol, $period, $n));
    }

    public function Indicator_RSI(string $symbol, string $period = 'daily', int $n = 14): JsonResponse
    {
        return $this->toJsonResponse($this->indicatorRsiData($symbol, $period, $n));
    }

    public function Indicator_MACD(
        string $symbol,
        string $period = 'daily',
        int $fast = 12,
        int $slow = 26,
        int $signal = 9
    ): JsonResponse {
        return $this->toJsonResponse($this->indicatorMacdData($symbol, $period, $fast, $slow, $signal));
    }

    public function Indicator_BollingerBands(string $symbol, string $period = 'daily', float $stdDevMultiplier = 2.0, int $n = 20): JsonResponse
    {
        return $this->toJsonResponse($this->indicatorBollingerBandsData($symbol, $period, $stdDevMultiplier, $n));
    }

    public function Indicator_StochasticOscillator(string $symbol, string $period = 'daily', int $kPeriod = 14, int $dPeriod = 3): JsonResponse
    {
        return $this->toJsonResponse($this->indicatorStochasticOscillatorData($symbol, $period, $kPeriod, $dPeriod));
    }

    private function toJsonResponse(array $payload): JsonResponse
    {
        $status = array_key_exists('error', $payload) ? 422 : 200;
        return response()->json($payload, $status);
    }
}