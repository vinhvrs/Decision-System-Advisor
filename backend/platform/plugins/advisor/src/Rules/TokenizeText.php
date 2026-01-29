<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class TokenizeText
{
    public function handle(string $text, SmoothContext $ctx): string
    {
        // normalize basic
        $normalized = strtolower($text);

        // split by non-alphanumeric
        $tokens = preg_split('/[^a-z0-9]+/', $normalized);

        // keep everything meaningful (NO stopword removal here)
        $tokens = array_values(array_filter($tokens, fn ($t) => $t !== ''));

        // store raw tokens
        $ctx->set('tokens', $tokens);

        return $normalized;
    }
}
