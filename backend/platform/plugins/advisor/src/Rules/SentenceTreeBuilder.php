<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class SentenceTreeBuilder
{
    protected array $intentPhrases;

    public function __construct()
    {
        $this->intentPhrases = require __DIR__ . '/../Dictionaries/intent_phrases.php';
    }

    public function handle(string $text, SmoothContext $ctx): string
    {
        $tokens   = $ctx->get('tokens', []);
        $semantic = $ctx->get('semantic', []);

        // collect all action keywords
        $actionWords = array_merge(...array_values($this->intentPhrases));

        $tree = [
            'action'    => $semantic['actions'][0] ?? null,
            'target'    => null,
            'features'  => array_keys($semantic['features'] ?? []),
            'modifiers' => [
                'negated'  => array_keys(array_filter(
                    $semantic['constraints'] ?? [],
                    fn($v) => $v === false
                )),
            ],
        ];

        foreach ($tokens as $token) {
            if (in_array($token, $actionWords)) {
                continue;
            }

            if (preg_match('/^[a-z]{2,5}$/', $token)) {
                $tree['target'] = $token;
                break;
            }
        }

        $ctx->set('sentence_tree', $tree);

        return $text;
    }
}
