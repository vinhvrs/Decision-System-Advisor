<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class DecisionBuilder
{
    /**
     * Build final Decision Object
     *
     * Decision = single source of truth
     */
    public function handle(string $text, SmoothContext $ctx): string
    {
        $intent   = $ctx->memory['intent'] ?? 'unknown';
        $entities = $ctx->memory['entities'] ?? [];
        $tree     = $ctx->memory['sentence_tree'] ?? [];
        $semantic = $ctx->memory['semantic'] ?? [];

        $decision = [
            'intent' => $intent,
            'entity' => [
                'tickers'    => $entities['tickers'] ?? [],
                'indicators' => $entities['indicators'] ?? [],
            ],
            'modifiers' => [
                'negated'    => $tree['modifiers']['negated'] ?? [],
                'constraints'=> $semantic['constraints'] ?? [],
                'features'   => $semantic['features'] ?? [],
            ],
            'confidence' => $this->estimateConfidence($intent, $entities, $tree),
        ];

        // 🔹 Store decision in context (🎯 CORE OUTPUT)
        $ctx->memory['decision'] = $decision;

        return $text;
    }

    /**
     * Rough confidence estimation
     */
    protected function estimateConfidence(
        string $intent,
        array $entities,
        array $tree
    ): float {
        $score = 0.0;

        if ($intent !== 'unknown') {
            $score += 0.4;
        }

        if (!empty($entities['tickers'])) {
            $score += 0.3;
        }

        if (!empty($tree['action'])) {
            $score += 0.2;
        }

        if (!empty($tree['features'])) {
            $score += 0.1;
        }

        return min(1.0, $score);
    }
}
