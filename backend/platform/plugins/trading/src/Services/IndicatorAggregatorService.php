<?php

namespace Platform\Plugins\Trading\Src\Services;

class IndicatorAggregatorService
{
    /** Weights sum to 1.0 */
    protected array $weights = [
        'ema'        => 0.25,
        'sma'        => 0.20,
        'rsi'        => 0.15,
        'macd'       => 0.20,
        'stochastic' => 0.10,
        'bollinger'  => 0.10,
    ];

    /**
     * Per-volatility BUY/SELL thresholds: high volatility needs a stronger weighted score;
     * low volatility allows BUY/SELL at smaller scores.
     */
    protected array $thresholdByVol = [
        'high'   => 0.55,
        'medium' => 0.40,
        'low'    => 0.30,
    ];

    /**
     * Scales confidence (instead of abs(score)*100). With ±2 signals the raw score can exceed 1;
     * confidence is clamped to 0..100 after dividing by this scale.
     */
    protected float $confidenceScale = 0.80; // realistic "strong" score

    public function aggregate(array $data, float $price): array
    {
        $ind = $data['indicators'] ?? [];

        // Minimum inputs
        $smaVal = (float)($ind['sma']['sma'] ?? 0);
        $emaVal = (float)($ind['ema']['ema'] ?? 0);

        $signals = [
            'sma'        => $this->maSignal($price, $smaVal),
            'ema'        => $this->maSignal($price, $emaVal),
            'rsi'        => $this->rsiSignal($ind['rsi']['rsi'] ?? null),
            'macd'       => $this->macdSignal($ind['macd'] ?? []),
            'stochastic' => $this->stochasticSignal($ind['stochastic'] ?? []),
            'bollinger'  => $this->bollingerSignal($price, $ind['bollinger_bands'] ?? []),
        ];

        // 1) weighted score
        $score = 0.0;
        foreach ($signals as $k => $v) {
            $score += (float)$v * (float)($this->weights[$k] ?? 0);
        }

        // 2) volatility → threshold
        $volatility = $this->volatilityFromBB($ind['bollinger_bands'] ?? []);
        $threshold = (float)($this->thresholdByVol[$volatility] ?? 0.40);

        // 3) decision
        $recommendation = match (true) {
            $score >= $threshold  => 'BUY',
            $score <= -$threshold => 'SELL',
            default               => 'HOLD',
        };

        // 4) confidence (normalize)
        // abs(score) / confidenceScale -> 0..1 -> 0..100
        $confidence = (int)round(
            min(max(abs($score) / max($this->confidenceScale, 0.0001), 0), 1) * 100
        );

        // 5) summary + reasons
        $trend = $this->trendFromMAWeighted($signals);
        $momentum = $this->momentumFromOscillators($signals);

        [$highlights, $warnings] = $this->buildReasons(
            $signals,
            $trend,
            $momentum,
            $volatility,
            $price,
            $smaVal,
            $emaVal,
            $ind
        );

        return [
            'symbol' => $data['symbol'] ?? null,
            'period' => $data['period'] ?? null,

            'recommendation'   => $recommendation,
            'score'            => round($score, 2),
            'confidence_score' => $confidence,

            'technical_summary' => [
                'trend'      => $trend,
                'momentum'   => $momentum,
                'volatility' => $volatility,
                'threshold'  => $threshold, // debug-friendly
            ],

            'signals' => $signals,

            // Human-readable reasons for composer / UI
            'highlights' => $highlights,
            'warnings'   => $warnings,
        ];
    }

    private function maSignal(float $price, float $ma): int
    {
        if ($ma <= 0) return 0;

        $diff = ($price - $ma) / $ma;      // signed
        $adiff = abs($diff);               // magnitude

        // Too close to MA → neutral
        if ($adiff < 0.003) { // 0.3%
            return 0;
        }

        // strong deviation
        if ($adiff >= 0.015) { // 1.5%
            return $diff > 0 ? 2 : -2;
        }

        // normal deviation
        return $diff > 0 ? 1 : -1;
    }

    private function rsiSignal(?float $rsi): int
    {
        if ($rsi === null || $rsi <= 0) return 0;

        return match (true) {
            $rsi < 25 => 2,   // very oversold
            $rsi < 30 => 1,   // oversold
            $rsi > 75 => -2,  // very overbought
            $rsi > 70 => -1,  // overbought
            default   => 0,
        };
    }

    private function macdSignal(array $macd): int
    {
        $c = $macd['crossover'] ?? null;

        // Use histogram magnitude when present
        $hist = $macd['histogram'] ?? null;

        if ($c === 'bullish') {
            // Stronger bullish when histogram is large
            if (is_numeric($hist) && (float)$hist > 0.5) return 2;
            return 1;
        }

        if ($c === 'bearish') {
            if (is_numeric($hist) && (float)$hist < -0.5) return -2;
            return -1;
        }

        return 0;
    }

    private function stochasticSignal(array $sto): int
    {
        $k = $sto['percent_k'] ?? null;
        if (!is_numeric($k)) return 0;

        $k = (float)$k;

        return match (true) {
            $k < 15  => 2,
            $k < 20  => 1,
            $k > 85  => -2,
            $k > 80  => -1,
            default  => 0,
        };
    }

    private function bollingerSignal(float $price, array $bb): int
    {
        $upper = $bb['upper_band'] ?? null;
        $lower = $bb['lower_band'] ?? null;

        if (!is_numeric($upper) || !is_numeric($lower)) return 0;

        $upper = (float)$upper;
        $lower = (float)$lower;

        // strong breakout outside band
        if ($price < $lower * 0.995) return 2;
        if ($price > $upper * 1.005) return -2;

        // touch band
        if ($price < $lower) return 1;
        if ($price > $upper) return -1;

        return 0;
    }

    private function trendFromMAWeighted(array $signals): string
    {
        // use weight-aware trend
        $t = ($signals['ema'] ?? 0) * 0.25 + ($signals['sma'] ?? 0) * 0.20;

        return match (true) {
            $t > 0.05 => 'bullish',
            $t < -0.05 => 'bearish',
            default => 'sideways',
        };
    }

    private function momentumFromOscillators(array $signals): string
    {
        $m = ($signals['rsi'] ?? 0) + ($signals['stochastic'] ?? 0) + ($signals['macd'] ?? 0);

        return match (true) {
            $m >= 2  => 'strong',
            $m >= 1  => 'moderate',
            $m <= -2 => 'strong_bearish',
            $m <= -1 => 'moderate_bearish',
            default  => 'neutral',
        };
    }

    private function volatilityFromBB(array $bb): string
    {
        $upper = $bb['upper_band'] ?? null;
        $lower = $bb['lower_band'] ?? null;

        if (!is_numeric($upper) || !is_numeric($lower)) {
            return 'medium';
        }

        $width = (float)$upper - (float)$lower;

        // Legacy width buckets; calibrate per instrument/period if needed
        return match (true) {
            $width > 30 => 'high',
            $width > 15 => 'medium',
            default     => 'low',
        };
    }

    private function buildReasons(
        array $signals,
        string $trend,
        string $momentum,
        string $volatility,
        float $price,
        float $sma,
        float $ema,
        array $ind
    ): array {
        $highlights = [];
        $warnings = [];

        // Trend reasons
        if ($trend === 'bullish') {
            $highlights[] = 'Trend is bullish based on moving averages.';
        } elseif ($trend === 'bearish') {
            $highlights[] = 'Trend is bearish based on moving averages.';
        } else {
            $highlights[] = 'Trend is mixed/sideways; signals are not strongly aligned.';
        }

        // MA positioning
        if ($sma > 0) {
            $highlights[] = $price > $sma
                ? 'Price is trading above SMA (supporting bullish bias).'
                : 'Price is trading below SMA (bearish pressure).';
        }
        if ($ema > 0) {
            $highlights[] = $price > $ema
                ? 'Price is trading above EMA (short-term strength).'
                : 'Price is trading below EMA (short-term weakness).';
        }

        // Momentum reasons
        if (str_contains($momentum, 'strong')) {
            $highlights[] = 'Momentum indicators suggest strong movement.';
        } elseif (str_contains($momentum, 'moderate')) {
            $highlights[] = 'Momentum is moderate; confirmation may be needed.';
        } else {
            $highlights[] = 'Momentum indicators are mostly neutral.';
        }

        // RSI warnings
        $rsi = $ind['rsi']['rsi'] ?? null;
        if (is_numeric($rsi)) {
            $rsi = (float)$rsi;
            if ($rsi > 70) $warnings[] = 'RSI indicates overbought conditions (pullback risk).';
            if ($rsi < 30) $warnings[] = 'RSI indicates oversold conditions (rebound potential).';
        }

        // Volatility warnings
        if ($volatility === 'high') {
            $warnings[] = 'Volatility is high; position sizing and risk control are important.';
        } elseif ($volatility === 'low') {
            $highlights[] = 'Volatility is relatively low; breakouts may need confirmation.';
        }

        // Bollinger touch
        $bb = $ind['bollinger_bands'] ?? [];
        if (is_numeric($bb['upper_band'] ?? null) && is_numeric($bb['lower_band'] ?? null)) {
            $upper = (float)$bb['upper_band'];
            $lower = (float)$bb['lower_band'];
            if ($price > $upper) $warnings[] = 'Price is above the upper Bollinger Band (overextension risk).';
            if ($price < $lower) $warnings[] = 'Price is below the lower Bollinger Band (capitulation / rebound zone).';
        }

        // De-dup + keep concise
        $highlights = array_values(array_unique($highlights));
        $warnings   = array_values(array_unique($warnings));

        // limit length to avoid spam
        $highlights = array_slice($highlights, 0, 6);
        $warnings   = array_slice($warnings, 0, 6);

        return [$highlights, $warnings];
    }
}