<?php

namespace Platform\Plugins\Advisor\Src\Services;

class ResponseComposerService
{
    protected array $phrases;
    protected array $connectors;

    public function __construct()
    {
        // Load dictionaries
        $this->phrases    = config('advisor.phrases');
        $this->connectors = config('advisor.connectors');
    }

    /* ======================================================
     * PUBLIC API
     * ====================================================== */

    public function compose(array $decision, array $options = []): array
    {
        $profile = $options['profile'] ?? 'spoken_professional';
        $style   = $options['style']   ?? 'standard';

        return [
            'recommendation' => $decision['recommendation'],
            'confidence'     => $decision['confidence_score'],
            'message'        => $this->buildMessage($decision, $profile, $style),
            'highlights'     => $this->buildHighlights($decision),
            'warnings'       => $this->buildWarnings($decision),
        ];
    }

    /* ======================================================
     * CORE MESSAGE BUILDER
     * ====================================================== */

    private function buildMessage(array $d, string $profile, string $style): string
    {
        $segments = [];

        /* 1️⃣ PREFIX */
        $segments[] = $this->pick(
            $this->phrases['prefix'][$profile]
            ?? $this->phrases['prefix']['default']
        );

        /* 2️⃣ RECOMMENDATION CORE */
        $segments[] = $this->pick(
            $this->phrases['recommendation'][$d['recommendation']]
        );

        /* 3️⃣ CONNECTOR */
        $segments[] = $this->pick($this->connectors['neutral']);

        /* 4️⃣ TREND */
        $trend = $d['technical_summary']['trend'] ?? null;
        if ($trend && isset($this->phrases['trend'][$trend])) {
            $segments[] = $this->pick($this->phrases['trend'][$trend]);
        }

        /* 5️⃣ MOMENTUM */
        $momentum = $d['technical_summary']['momentum'] ?? null;
        if ($momentum && isset($this->phrases['momentum'][$momentum])) {
            $segments[] = $this->pick($this->phrases['momentum'][$momentum]);
        }

        /* 6️⃣ VOLATILITY (OPTIONAL) */
        $volatility = $d['technical_summary']['volatility'] ?? null;
        if ($volatility && isset($this->phrases['volatility'][$volatility])) {
            $segments[] = $this->pick($this->phrases['volatility'][$volatility]);
        }

        /* 7️⃣ FOLLOW-UP (OPTIONAL) */
        if ($style !== 'concise' && !empty($this->phrases['follow_up'])) {
            $segments[] = $this->pick($this->phrases['follow_up']);
        }

        $response = ucfirst(
            rtrim(implode(', ', array_filter($segments)), ', ')
        ) . '.';
        $response = preg_replace('/,+/', ',', $response);
        $response = preg_replace('/\.\.+/', '.', $response);

        return $response;
    }

    /* ======================================================
     * HIGHLIGHTS (POSITIVE SIGNALS)
     * ====================================================== */

    private function buildHighlights(array $d): array
    {
        $out = [];

        // SMA + EMA bullish
        if (
            ($d['signals']['sma'] ?? 0) === 1 &&
            ($d['signals']['ema'] ?? 0) === 1
        ) {
            $out[] = $this->pick([
                'Price remains above key moving averages.',
                'Moving averages continue to support the prevailing trend.',
            ]);
        }

        // Bullish trend
        if (($d['technical_summary']['trend'] ?? '') === 'bullish') {
            $out[] = $this->pick(
                $this->phrases['trend']['bullish']
            );
        }

        return array_values(array_filter($out));
    }

    /* ======================================================
     * WARNINGS (RISK SIGNALS)
     * ====================================================== */

    private function buildWarnings(array $d): array
    {
        $warnings = [];

        // Stochastic overbought
        if (($d['signals']['stochastic'] ?? 0) === -1) {
            $warnings[] = $this->pick([
                'Short-term momentum suggests potential overbought conditions.',
                'Stochastic readings indicate limited upside in the near term.',
            ]);
        }

        // Bollinger upper band
        if (($d['signals']['bollinger'] ?? 0) === -1) {
            $warnings[] = $this->pick([
                'Price is approaching the upper Bollinger Band.',
                'Upside may be capped within the current volatility range.',
            ]);
        }

        return $warnings;
    }

    /* ======================================================
     * RANDOM HELPER
     * ====================================================== */

    private function pick(array $items): ?string
    {
        if (empty($items)) {
            return null;
        }

        return $items[array_rand($items)];
    }
}
