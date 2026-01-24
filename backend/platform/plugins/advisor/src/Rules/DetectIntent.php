<?php

namespace Platform\Plugins\Advisor\Src\Rules;

class DetectIntent
{
    public function __construct(private array $intentPhrases)
    {
    }

    public function handle(string $cleanText, array $entities): ?string
    {
        $t = strtolower($cleanText);

        foreach ($this->intentPhrases as $intent => $phrases) {
            foreach ($phrases as $p) {
                if (str_contains($t, $p)) {
                    return $intent;
                }
            }
        }

        // fallback only if NO explicit intent
        if (!empty($entities['tickers'])) {
            return 'price_check';
        }

        return null;
    }

}
