<?php

namespace Platform\Plugins\Advisor\Src\Services;

class ResponseComposerService
{
    protected array $phrases;
    protected array $connectors;

    public function __construct()
    {
        $this->phrases    = config('advisor.phrases');
        $this->connectors = config('advisor.connectors');
    }

    public function compose(array $decision, array $options = []): array
    {
        $profile = $options['profile'] ?? 'spoken_professional';
        $style   = $options['style']   ?? 'standard';

        // ✅ Prefer reasons from Aggregator (new pipeline)
        $highlights = $this->mergeReasons(
            $decision['highlights'] ?? [],
            $this->buildHighlights($decision) // fallback old logic
        );

        $warnings = $this->mergeReasons(
            $decision['warnings'] ?? [],
            $this->buildWarnings($decision) // fallback old logic
        );

        return [
            'recommendation' => $decision['recommendation'] ?? 'HOLD',
            'confidence'     => (int)($decision['confidence_score'] ?? 0),
            'message'        => $this->buildMessage($decision, $profile, $style),

            // ✅ now not empty if aggregator provided them
            'highlights'     => $highlights,
            'warnings'       => $warnings,
        ];
    }

    /* ======================================================
     * CORE MESSAGE BUILDER
     * ====================================================== */

    private function buildMessage(array $d, string $profile, string $style): string
    {
        $segments = [];

        $segments[] = $this->pick(
            $this->phrases['prefix'][$profile]
            ?? $this->phrases['prefix']['default']
            ?? ['Based on the current technical setup']
        );

        $rec = $d['recommendation'] ?? 'HOLD';
        $segments[] = $this->pick(
            $this->phrases['recommendation'][$rec]
            ?? [$rec]
        );

        $segments[] = $this->pick($this->connectors['neutral'] ?? ['At the same time']);

        $trend = $d['technical_summary']['trend'] ?? null;
        if ($trend && isset($this->phrases['trend'][$trend])) {
            $segments[] = $this->pick($this->phrases['trend'][$trend]);
        }

        $momentum = $d['technical_summary']['momentum'] ?? null;
        if ($momentum && isset($this->phrases['momentum'][$momentum])) {
            $segments[] = $this->pick($this->phrases['momentum'][$momentum]);
        }

        $volatility = $d['technical_summary']['volatility'] ?? null;
        if ($volatility && isset($this->phrases['volatility'][$volatility])) {
            $segments[] = $this->pick($this->phrases['volatility'][$volatility]);
        }

        if ($style !== 'concise' && !empty($this->phrases['follow_up'])) {
            $segments[] = $this->pick($this->phrases['follow_up']);
        }

        $response = ucfirst(rtrim(implode(', ', array_filter($segments)), ', ')) . '.';
        $response = preg_replace('/,+/', ',', $response);
        $response = preg_replace('/\.\.+/', '.', $response);

        return $response;
    }

    /* ======================================================
     * HIGHLIGHTS (fallback rules)
     * Supports signal strength -2..+2
     * ====================================================== */

    private function buildHighlights(array $d): array
    {
        $out = [];

        $sma = (int)($d['signals']['sma'] ?? 0);
        $ema = (int)($d['signals']['ema'] ?? 0);

        // ✅ old rule was === 1; now accept >= 1
        if ($sma >= 1 && $ema >= 1) {
            $out[] = $this->pick([
                'Price remains above key moving averages.',
                'Moving averages continue to support the prevailing trend.',
            ]);
        }

        $trend = $d['technical_summary']['trend'] ?? '';
        if ($trend === 'bullish' && isset($this->phrases['trend']['bullish'])) {
            $out[] = $this->pick($this->phrases['trend']['bullish']);
        }

        return array_values(array_filter($out));
    }

    /* ======================================================
     * WARNINGS (fallback rules)
     * Supports signal strength -2..+2
     * ====================================================== */

    private function buildWarnings(array $d): array
    {
        $warnings = [];

        $sto = (int)($d['signals']['stochastic'] ?? 0);
        $bb  = (int)($d['signals']['bollinger'] ?? 0);

        // ✅ old rule was === -1; now accept <= -1
        if ($sto <= -1) {
            $warnings[] = $this->pick([
                'Short-term momentum suggests potential overbought conditions.',
                'Stochastic readings indicate limited upside in the near term.',
            ]);
        }

        if ($bb <= -1) {
            $warnings[] = $this->pick([
                'Price is approaching the upper Bollinger Band.',
                'Upside may be capped within the current volatility range.',
            ]);
        }

        return array_values(array_filter($warnings));
    }

    /* ======================================================
     * MERGE + CLEAN
     * ====================================================== */

    private function mergeReasons(array $primary, array $fallback): array
    {
        // normalize strings + remove empties
        $primary = array_values(array_filter(array_map('strval', $primary)));
        $fallback = array_values(array_filter(array_map('strval', $fallback)));

        // merge (primary first)
        $merged = array_values(array_unique(array_merge($primary, $fallback)));

        // keep concise
        return array_slice($merged, 0, 6);
    }

    /* ======================================================
     * RANDOM HELPER
     * ====================================================== */

    private function pick(array $items): ?string
    {
        if (empty($items)) return null;
        return $items[array_rand($items)];
    }
}