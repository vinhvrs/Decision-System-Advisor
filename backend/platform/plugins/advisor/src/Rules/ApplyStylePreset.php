<?php

namespace Platform\Plugins\Advisor\Src\Rules;

class ApplyStylePreset
{
    public function __construct(private array $preset) {}

    public function handle(string $text): string
    {
        $max = (int)($this->preset['max_sentences'] ?? 10);
        $sentences = preg_split('/(?<=[.!?])\s+/', trim($text)) ?: [];

        if (count($sentences) > $max) {
            $sentences = array_slice($sentences, 0, $max);
            $text = implode(' ', $sentences);
        }

        return $text;
    }
}
