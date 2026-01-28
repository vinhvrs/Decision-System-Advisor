<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class NormalizeEntities
{
    public function handle(string $text, SmoothContext $ctx): string
    {
        $tokens   = $ctx->get('tokens', []);
        $semantic = $ctx->get('semantic', []);
        $tree     = $ctx->get('sentence_tree', []);

        $tickers    = [];
        $indicators = [];

        $features = array_keys($semantic['features'] ?? []);

        foreach ($tokens as $token) {
            // feature → indicator
            if (in_array($token, $features)) {
                $indicators[] = strtoupper($token);
                continue;
            }

            // tree target → ticker
            if ($token === ($tree['target'] ?? null)) {
                $tickers[] = strtoupper($token);
            }
        }

        $ctx->set('entities', [
            'tickers'    => array_values(array_unique($tickers)),
            'indicators' => array_values(array_unique($indicators)),
        ]);

        return $text;
    }
}
