<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class DetectIntent
{
    protected array $intentPhrases;

    public function __construct(array $intentPhrases)
    {
        $this->intentPhrases = $intentPhrases;
    }

    public function handle(string $text, SmoothContext $ctx): string
    {
        $semantic = $ctx->get('semantic', []);

        $intent = 'unknown';

        foreach ($this->intentPhrases as $intentName => $keywords) {
            if (array_intersect($semantic['actions'] ?? [], $keywords)) {
                $intent = $intentName;
                break;
            }
        }

        $ctx->set('intent', $intent);

        return $text;
    }
}
