<?php

namespace Platform\Plugins\Advisor\Src\Rules;

class ApplyStylePreset
{
    public function __construct(
        protected array $preset = []
    ) {}

    public function handle(string $text): string
    {
        $max = $this->preset['max_sentences'] ?? null;

        if ($max !== null) {
            $sentences = preg_split('/(?<=[.!?])\s+/', trim($text));
            $sentences = array_slice($sentences, 0, $max);
            $text = implode(' ', $sentences);
        }

        return trim($text);
    }
}
