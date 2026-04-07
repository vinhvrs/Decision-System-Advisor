<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class DecisionBuilder
{
    protected array $strategies;

    public function __construct()
    {
        $this->strategies = config('language_smooth.response_strategy', []);
    }

    public function handle(string $text, SmoothContext $ctx): string
    {
        $intent   = $ctx->memory['intent']   ?? 'unknown';
        $entities = $ctx->memory['entities'] ?? [];

        // 1) Resolve strategy
        $strategy = $this->strategies[$intent]
            ?? $this->strategies['unknown']
            ?? [
                'mode' => 'fallback',
                'require_data' => false,
                'allow_llm' => true,
            ];
        
        // 2) Validate required data
        if (($strategy['require_data'] ?? false) === true) {
            if (empty($entities['tickers'])) {
                $ctx->memory['decision'] = [
                    'intent' => $intent,
                    'entities' => $entities,
                    'strategy' => $strategy,
                    'error' => 'missing_ticker',
                    'confidence' => 0.2,
                ];

                // Return pipeline text as-is (no extra wording here)
                return $text;
            }
        }

        // 3) Store final decision
        $ctx->memory['decision'] = [
            'intent'   => $intent,
            'entities' => $entities,
            'strategy' => $strategy,
            'confidence' => 0.9,
        ];

        return $text;
    }
}
