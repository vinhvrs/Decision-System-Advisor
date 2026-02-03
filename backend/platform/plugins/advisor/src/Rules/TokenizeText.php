<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;
use Platform\Plugins\Advisor\Src\Services\StrategyResolverService;

class TokenizeText
{
    public function handle(string $text, SmoothContext $ctx): string
    {
        $tokens = preg_split('/\W+/', strtolower($text)) ?: [];

        $resolver = app(StrategyResolverService::class);
        $stopwords = $resolver->getStopwords();

        $tokens = array_values(array_filter(
            $tokens,
            fn($t) => $t !== '' && !in_array($t, $stopwords, true)
        ));

        $ctx->memory['tokens'] = $tokens;

        return $text;
    }
}
