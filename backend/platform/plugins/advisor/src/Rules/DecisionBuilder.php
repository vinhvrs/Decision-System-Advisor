<?php

namespace Platform\Plugins\Advisor\Src\Services;

use Platform\Plugins\Advisor\Src\DTO\Decision;
use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class DecisionBuilder
{
    public function build(SmoothContext $ctx): Decision
    {
        $tree = $ctx->memory['sentence_tree'] ?? [];

        $d = new Decision();

        /* ---------- INTENT ---------- */
        $d->intent = match ($tree['action'] ?? null) {
            'news'    => 'GET_NEWS',
            'price'   => 'GET_PRICE',
            'compare' => 'COMPARE',
            'advice'  => 'INVEST_ADVICE',
            default   => 'GENERAL_QUERY',
        };

        /* ---------- ENTITY ---------- */
        if (!empty($tree['target'])) {
            $d->entity['symbol'] = strtoupper($tree['target']);
        }

        /* ---------- MODIFIERS ---------- */
        if (!empty($tree['modifiers']['negated'])) {
            $d->modifiers['negated'] = true;
        }

        if (in_array('full_text', $tree['modifiers']['positive'] ?? [], true)) {
            $d->modifiers['short'] = false;
        }

        if (in_array('analysis', $tree['modifiers']['negated'] ?? [], true)) {
            $d->modifiers['noAnalysis'] = true;
        }

        /* ---------- CONFIDENCE ---------- */
        $d->confidence =
            ($d->entity['symbol'] ? 0.4 : 0.0) +
            ($d->intent !== 'GENERAL_QUERY' ? 0.4 : 0.0) +
            (!empty($tree['features']) ? 0.2 : 0.0);

        return $d;
    }
}
