<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class NormalizeEntities
{
    protected array $strategy;
    protected array $indicators;

    public function __construct()
    {
        $this->strategy = require __DIR__ . '/../Dictionaries/strategy.php';
        $this->indicators = require __DIR__ . '/../Dictionaries/indicator.php';
    }

    public function handle(string $text, SmoothContext $ctx): string
    {
        $tokens = $ctx->memory['tokens'] ?? [];
        $semantic = $ctx->memory['semantic'] ?? [];
        $tree = $ctx->memory['sentence_tree'] ?? [];

        $entities = [
            'tickers' => [],
            'indicators' => [],
        ];

        /**
         * --------------------------------------------------
         * 1️⃣ INDICATORS (EXPLICIT, FROM DICTIONARY)
         * --------------------------------------------------
         */
        foreach ($tokens as $token) {
            $lower = strtolower($token);

            if (isset($this->indicators[$lower])) {
                $entities['indicators'][] = strtoupper($lower);
            }
        }

        /**
         * --------------------------------------------------
         * 2️⃣ BUILD BLACKLIST (DO NOT BECOME TICKER)
         * --------------------------------------------------
         */
        $blacklist = array_merge(
            $semantic['actions'] ?? [],
            array_keys($semantic['constraints'] ?? []),
            $tree['modifiers']['negated'] ?? [],
            array_keys($semantic['features'] ?? []),
            $this->strategy['verbs'] ?? [],
            $this->strategy['fillers'] ?? [],
            $this->strategy['stopwords'] ?? [],   // 👈 CHÌA KHÓA CUỐI
            $this->strategy['negations'] ?? [],
            $this->strategy['domain_nouns'] ?? []
        );


        $blacklist = array_map('strtolower', $blacklist);

        /**
         * --------------------------------------------------
         * 3️⃣ TICKER CANDIDATES (STRICT)
         * --------------------------------------------------
         */
        foreach ($tokens as $token) {
            $upper = strtoupper($token);
            $lower = strtolower($token);

            // ❌ Skip anything already classified
            if (in_array($lower, $blacklist, true)) {
                continue;
            }

            // ❌ Skip indicators
            if (isset($this->indicators[$lower])) {
                continue;
            }

            // ✅ Heuristic: stock ticker format
            if (preg_match('/^[A-Z]{2,6}$/', $upper)) {
                $entities['tickers'][] = $upper;
            }
        }

        /**
         * --------------------------------------------------
         * 4️⃣ DEDUP
         * --------------------------------------------------
         */
        $entities['tickers'] = array_values(array_unique($entities['tickers']));
        $entities['indicators'] = array_values(array_unique($entities['indicators']));

        $ctx->memory['entities'] = $entities;

        return $text;
    }
}
