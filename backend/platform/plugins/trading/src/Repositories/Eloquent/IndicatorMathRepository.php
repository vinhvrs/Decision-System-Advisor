<?php
namespace Platform\Plugins\Trading\Src\Repositories\Eloquent;

use Platform\Plugins\Trading\Src\Repositories\Interfaces\IndicatorMathInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

class IndicatorMathRepository implements IndicatorMathInterface
{
    public function lastNonNull(array $arr)
    {
        for ($i = count($arr) - 1; $i >= 0; $i--) {
            if ($arr[$i] !== null)
                return $arr[$i];
        }
        return null;
    }

    public function calculateSMA(array $data, int $period): array
    {
        $sma = [];
        $dataCount = count($data);
        for ($i = 0; $i <= $dataCount - $period; $i++) {
            $sum = 0;
            for ($j = 0; $j < $period; $j++) {
                $sum += $data[$i + $j];
            }
            $sma[] = $sum / $period;
        }
        return $sma;
    }

    public function calculateEMA(array $data, int $period): array
    {
        $ema = [];
        $k = 2 / ($period + 1);
        $ema[0] = array_sum(array_slice($data, 0, $period)) / $period;

        for ($i = 1; $i < count($data); $i++) {
            $ema[$i] = ($data[$i] * $k) + ($ema[$i - 1] * (1 - $k));
        }
        return $ema;
    }

    public function calculateRSI(array $data, int $period): array
    {
        $rsi = [];
        for ($i = $period; $i < count($data); $i++) {
            $gains = 0;
            $losses = 0;
            for ($j = 0; $j < $period; $j++) {
                $change = $data[$i - $j] - $data[$i - $j - 1];
                if ($change > 0) {
                    $gains += $change;
                } else {
                    $losses -= $change;
                }
            }
            if ($losses == 0) {
                $rsi[] = 100;
            } else {
                $rs = $gains / $losses;
                $rsi[] = 100 - (100 / (1 + $rs));
            }
        }
        return $rsi;
    }

    public function calculateMACD(array $closes, int $fast, int $slow, int $signal): array
    {
        $emaFast = $this->calculateEMA($closes, $fast);
        $emaSlow = $this->calculateEMA($closes, $slow);

        $T = count($closes);
        $macdLine = array_fill(0, $T, null);
        for ($t = 0; $t < $T; $t++) {
            $macdLine[$t] = (float) $emaFast[$t] - (float) $emaSlow[$t];
        }

        $signalLine = $this->calculateEMA($macdLine, $signal);

        $hist = array_fill(0, $T, null);
        for ($t = 0; $t < $T; $t++) {
            $hist[$t] = (float) $macdLine[$t] - (float) $signalLine[$t];
        }

        return [$macdLine, $signalLine, $hist];
    }

    public function calculateBollingerBands(array $data, int $period, float $k): array
    {
        $T = count($data);

        $lower = array_fill(0, $T, null);
        $middle = array_fill(0, $T, null);
        $upper = array_fill(0, $T, null);

        if ($T < $period)
            return [$lower, $middle, $upper];

        for ($i = $period - 1; $i < $T; $i++) {
            $slice = array_slice($data, $i - $period + 1, $period);

            $mean = array_sum($slice) / $period;

            $variance = 0.0;
            foreach ($slice as $v) {
                $d = $v - $mean;
                $variance += $d * $d;
            }
            $stdDev = sqrt($variance / $period);

            $middle[$i] = $mean;
            $upper[$i] = $mean + ($k * $stdDev);
            $lower[$i] = $mean - ($k * $stdDev);
        }

        return [$lower, $middle, $upper];
    }

    public function calculateStochasticOscillator(array $data, int $kPeriod, int $dPeriod): array
    {
        $T = count($data);
        $k = array_fill(0, $T, null);
        $d = array_fill(0, $T, null);

        if ($T === 0 || $kPeriod < 1 || $dPeriod < 1)
            return [$k, $d];

        for ($i = $kPeriod - 1; $i < $T; $i++) {
            $highestHigh = -INF;
            $lowestLow = INF;

            for ($j = $i - $kPeriod + 1; $j <= $i; $j++) {
                $highestHigh = max($highestHigh, (float) $data[$j]['high']);
                $lowestLow = min($lowestLow, (float) $data[$j]['low']);
            }

            $close = (float) $data[$i]['close'];
            $range = $highestHigh - $lowestLow;

            $k[$i] = ($range == 0.0) ? 50.0 : (100.0 * (($close - $lowestLow) / $range));
        }

        // %D = SMA(%K, dPeriod)
        for ($i = 0; $i < $T; $i++) {
            if ($i < ($kPeriod - 1) + ($dPeriod - 1))
                continue;

            $sum = 0.0;
            $ok = true;
            for ($j = $i - $dPeriod + 1; $j <= $i; $j++) {
                if ($k[$j] === null) {
                    $ok = false;
                    break;
                }
                $sum += (float) $k[$j];
            }
            if ($ok)
                $d[$i] = $sum / $dPeriod;
        }

        return [$k, $d];
    }


    /**
     * Detect crossover between 2 series at index $t:
     * - bullish: series1 crosses up series2
     * - bearish: series1 crosses down series2
     * - none: no crossover or not enough data
     */
    public function detectCrossoverAt(array $series1, array $series2, int $t): string
    {
        if ($t < 1)
            return 'none';

        // must exist
        if (!isset($series1[$t - 1], $series2[$t - 1], $series1[$t], $series2[$t]))
            return 'none';

        // avoid null -> (float)null = 0 bug
        if ($series1[$t - 1] === null || $series2[$t - 1] === null || $series1[$t] === null || $series2[$t] === null) {
            return 'none';
        }

        $m0 = (float) $series1[$t - 1];
        $s0 = (float) $series2[$t - 1];
        $m1 = (float) $series1[$t];
        $s1 = (float) $series2[$t];

        if ($m0 <= $s0 && $m1 > $s1)
            return 'bullish';
        if ($m0 >= $s0 && $m1 < $s1)
            return 'bearish';
        return 'none';
    }

    /**
     * Detect latest crossover (at the latest valid index).
     */
    public function detectCrossovers(array $series1, array $series2): string
    {
        $t = min(count($series1), count($series2)) - 1;
        if ($t < 1)
            return 'none';

        return $this->detectCrossoverAt($series1, $series2, $t);
    }

    public function getLastCandles(string $symbol, string $period, int $limit = 500): Collection
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
                'instrument_data.open as open',
                'instrument_data.high as high',
                'instrument_data.low as low',
                'instrument_data.volume as volume',
            ]);

        return $rows->reverse()->values();
    }
}