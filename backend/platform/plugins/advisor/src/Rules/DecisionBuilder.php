<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class DecisionBuilder
{
    public function handle(string $text, SmoothContext $ctx): string
    {
        $intent   = $ctx->memory['intent'] ?? 'unknown';
        $entities = $ctx->memory['entities'] ?? [];
        $tree     = $ctx->memory['sentence_tree'] ?? [];
        $semantic = $ctx->memory['semantic'] ?? [];

        $ctx->memory['decision'] = [
            'intent' => $intent,
            'entity' => [
                'tickers'    => $entities['tickers'] ?? [],
                'indicators' => $entities['indicators'] ?? [],
            ],
            'modifiers' => [
                'negated'     => $tree['modifiers']['negated'] ?? [],
                'constraints' => $semantic['constraints'] ?? [],
                'features'    => $semantic['features'] ?? [],
            ],
            'confidence' => 0.9,
        ];

        return $text;
    }
}
