<?php

namespace Platform\Plugins\Advisor\Src\Rules;

class PostProcess
{
    public function __construct(private array $glossary) {}

    public function handle(string $text): string
    {
        $text = trim($text);
        $text = preg_replace('/\s+/', ' ', $text);

        foreach ($this->glossary as $from => $to) {
            $pattern = '/\b' . preg_quote($from, '/') . '\b/i';
            $text = preg_replace($pattern, $to, $text);
        }

        // Ensure final punctuation
        if ($text !== '' && !preg_match('/[.!?]$/', $text)) {
            $text .= '.';
        }

        return $text;
    }
}
