<?php

namespace Platform\Plugins\Advisor\Src\Rules;

class FixTypos
{
    public function __construct(private array $typos) {}

    public function handle(string $text): string
    {
        // word-boundary replace
        foreach ($this->typos as $wrong => $right) {
            $pattern = '/\b' . preg_quote($wrong, '/') . '\b/i';
            $text = preg_replace($pattern, $right, $text);
        }
        return $text;
    }
}
