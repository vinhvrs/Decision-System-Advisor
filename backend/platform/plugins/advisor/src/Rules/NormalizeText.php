<?php

namespace Platform\Plugins\Advisor\Src\Rules;

class NormalizeText
{
    public function handle(string $text): string
    {
        $text = trim($text);
        $text = preg_replace('/\s+/', ' ', $text) ?? '';
        $text = preg_replace('/([!?.,])\1+/', '$1', $text) ?? '';
        $text = str_replace(["\u{201C}", "\u{201D}"], '"', $text);
        $text = str_replace(["\u{2018}", "\u{2019}"], "'", $text);
        return $text;
    }
}
