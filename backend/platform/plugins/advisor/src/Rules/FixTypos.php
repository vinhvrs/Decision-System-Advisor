<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class FixTypos
{
    public function __construct(
        protected array $typos = []
    ) {}

    public function handle(string $text, SmoothContext $ctx): string
    {
        foreach ($this->typos as $wrong => $correct) {
            $text = preg_replace(
                '/\b' . preg_quote($wrong, '/') . '\b/i',
                $correct,
                $text
            );
        }

        return $text;
    }
}
