<?php

namespace Platform\Plugins\Advisor\Src\Rules;

class NormalizeEntities
{
    public function handle(string $text, array &$entities): string
    {
        // Convert $aapl -> AAPL
        $text = preg_replace_callback('/\$(\w{2,6})\b/', fn($m) => strtoupper($m[1]), $text) ?? $text;

        // Basic ticker detection (heuristic)
        if (preg_match_all('/\b([A-Za-z]{2,6})\b/', $text, $m)) {
            $candidates = array_unique($m[1]);
            $tickers = [];

            foreach ($candidates as $c) {
                $t = strtoupper($c);
                if (!in_array($t, ['THE','AND','FOR','WITH','THIS','THAT','WHAT','NEWS','PRICE','ABOUT'])) {
                    // if you want stricter, check against a whitelist of tickers
                    $tickers[] = $t;
                }
            }

            if ($tickers) {
                $entities['tickers'] = array_values(array_unique($tickers));
            }
        }

        return $text;
    }
}
