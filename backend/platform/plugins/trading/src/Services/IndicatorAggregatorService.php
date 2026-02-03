<?php

namespace Platform\Plugins\Trading\Src\Services;

class IndicatorAggregatorService
{
    protected array $weights = [
        'ema' => 0.25,
        'sma' => 0.20,
        'rsi' => 0.15,
        'macd' => 0.20,
        'stochastic' => 0.10,
        'bollinger' => 0.10,
    ];

    public function aggregate(array $data, float $price): array
    {
        $ind = $data['indicators'];

        $signals = [
            'sma' => $this->maSignal($price, $ind['sma']['sma']),
            'ema' => $this->maSignal($price, $ind['ema']['ema']),
            'rsi' => $this->rsiSignal($ind['rsi']['rsi'] ?? null),
            'macd' => $this->macdSignal($ind['macd']),
            'stochastic' => $this->stochasticSignal($ind['stochastic']),
            'bollinger' => $this->bollingerSignal($price, $ind['bollinger_bands']),
        ];

        $score = 0;
        foreach ($signals as $k => $v) {
            $score += $v * ($this->weights[$k] ?? 0);
        }

        $recommendation = match (true) {
            $score >= 0.6  => 'BUY',
            $score <= -0.6 => 'SELL',
            default        => 'HOLD',
        };

        return [
            'symbol' => $data['symbol'],
            'period' => $data['period'],

            'recommendation' => $recommendation,
            'score' => round($score, 2),
            'confidence_score' => min((int)(abs($score) * 100), 100),

            'technical_summary' => [
                'trend' => $this->trendFromMA($signals),
                'momentum' => $this->momentumFromOscillators($signals),
                'volatility' => $this->volatilityFromBB($ind['bollinger_bands']),
            ],

            'signals' => $signals,
        ];
    }

    /* ================= SIGNALS ================= */

    private function maSignal(float $price, float $ma): int
    {
        $diff = abs($price - $ma) / $ma;

        // nếu quá gần MA → neutral
        if ($diff < 0.003) { // ~0.3%
            return 0;
        }

        return $price > $ma ? 1 : -1;
    }

    private function rsiSignal(?float $rsi): int
    {
        // guard: RSI = 0 hoặc null → ignore
        if ($rsi === null || $rsi <= 0) {
            return 0;
        }

        return match (true) {
            $rsi < 30 => 1,
            $rsi > 70 => -1,
            default => 0,
        };
    }

    private function macdSignal(array $macd): int
    {
        return match ($macd['crossover'] ?? null) {
            'bullish' => 1,
            'bearish' => -1,
            default => 0,
        };
    }

    private function stochasticSignal(array $sto): int
    {
        return match (true) {
            $sto['percent_k'] > 80 => -1,
            $sto['percent_k'] < 20 => 1,
            default => 0,
        };
    }

    private function bollingerSignal(float $price, array $bb): int
    {
        return match (true) {
            $price < $bb['lower_band'] => 1,
            $price > $bb['upper_band'] => -1,
            default => 0,
        };
    }

    /* ================= SUMMARY ================= */

    private function trendFromMA(array $signals): string
    {
        $t = ($signals['ema'] ?? 0) + ($signals['sma'] ?? 0);

        return match (true) {
            $t > 0 => 'bullish',
            $t < 0 => 'bearish',
            default => 'sideways',
        };
    }

    private function momentumFromOscillators(array $signals): string
    {
        $m = ($signals['rsi'] ?? 0) + ($signals['stochastic'] ?? 0);

        return abs($m) >= 1 ? 'moderate' : 'neutral';
    }

    private function volatilityFromBB(array $bb): string
    {
        $width = $bb['upper_band'] - $bb['lower_band'];

        return match (true) {
            $width > 30 => 'high',
            $width > 15 => 'medium',
            default => 'low',
        };
    }
}
