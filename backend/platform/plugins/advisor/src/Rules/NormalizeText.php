<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class NormalizeText
{
    public function handle(string $text, SmoothContext $ctx): string
    {
        // normalize whitespace
        $text = preg_replace('/\s+/', ' ', $text);

        // trim
        return trim($text);
    }
}
