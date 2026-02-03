<?php

namespace Platform\Plugins\Advisor\Src\ResponseComposer;

class PhraseRepository
{
    public static function intro(string $decision): array
    {
        return match ($decision) {
            'BUY' => [
                'The stock shows a positive technical outlook.',
                'Overall technical indicators suggest a favorable condition.'
            ],
            'SELL' => [
                'The stock exhibits signs of technical weakness.',
                'Technical indicators point to increasing downside risk.'
            ],
            default => [
                'The market is currently showing mixed technical signals.',
                'No dominant technical direction is observed at this stage.'
            ],
        };
    }

    public static function trend(string $trend): array
    {
        return match ($trend) {
            'bullish' => [
                'Trend indicators suggest upward movement.',
                'The prevailing trend remains positive.'
            ],
            'bearish' => [
                'Trend indicators indicate downward pressure.',
                'A negative trend is currently observed.'
            ],
            default => [
                'No clear directional trend has been established.'
            ],
        };
    }

    public static function momentum(string $momentum): array
    {
        return match ($momentum) {
            'strong' => [
                'Momentum indicators show strong buying pressure.'
            ],
            'moderate' => [
                'Momentum indicators remain relatively stable.'
            ],
            default => [
                'Momentum indicators do not show significant strength.'
            ],
        };
    }

    public static function confidence(int $score): array
    {
        return $score >= 70
            ? ['The confidence level of this signal is relatively high.']
            : ['The confidence level of this signal remains moderate.'];
    }

    public static function decision(string $decision): array
    {
        return [
            "Therefore, a {$decision} signal is generated."
        ];
    }
}
