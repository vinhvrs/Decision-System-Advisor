<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class BuildSemanticDictionary
{
    protected array $intentPhrases;
    protected array $indicators;
    protected array $negations;

    public function __construct(array $intentPhrases)
    {
        $this->intentPhrases = $intentPhrases;
        $this->indicators = require __DIR__ . '/../Dictionaries/indicator.php';
        $this->negations = config('language_smooth.negations', ['no', 'not', 'without']);
    }

    public function handle(string $text, SmoothContext $ctx): string
    {
        $tokens = $ctx->get('tokens', []);

        $semantic = [
            'actions' => [],
            'constraints' => [],
            'features' => [],
        ];

        foreach ($tokens as $i => $token) {

            // ACTIONS (from intent_phrases)
            foreach ($this->intentPhrases as $intent => $keywords) {
                if (in_array($token, $keywords)) {
                    $semantic['actions'][] = $token;
                }
            }

            // NEGATION
            if (in_array($token, $this->negations) && isset($tokens[$i + 1])) {
                $semantic['constraints'][$tokens[$i + 1]] = false;
            }

            // FEATURES / INDICATORS
            if (array_key_exists($token, $this->indicators)) {
                $semantic['features'][$token] = true;
            }
        }

        $ctx->set('semantic', $semantic);

        return $text;
    }
}
