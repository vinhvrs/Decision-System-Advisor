<?php

namespace Platform\Plugins\Trading\Src\Services;

use GuzzleHttp\Client;
use Illuminate\Support\Facades\DB;

class PriceQuoteService
{
    protected Client $client;

    public function __construct()
    {
        $this->client = new Client([
            'timeout' => 5,
            'verify' => false,
        ]);
    }

    /**
     * Get current price for a symbol.
     * Tries instrument_snapshot first, then Yahoo Finance.
     */
    public function getCurrentPrice(string $symbol): ?float
    {
        $symbol = strtoupper(trim($symbol));
        if ($symbol === '') {
            return null;
        }

        $price = DB::table('instrument_snapshot')
            ->where('symbol', $symbol)
            ->value('price');

        if ($price !== null && (float) $price > 0) {
            return (float) $price;
        }

        return $this->fetchFromYahoo($symbol);
    }

    /**
     * Get current prices for multiple symbols (batch).
     * Returns [symbol => price] for symbols that have data.
     */
    public function getCurrentPrices(array $symbols): array
    {
        $symbols = array_unique(array_map(fn ($s) => strtoupper(trim((string) $s)), $symbols));
        $symbols = array_filter($symbols);

        if (empty($symbols)) {
            return [];
        }

        $rows = DB::table('instrument_snapshot')
            ->whereIn('symbol', $symbols)
            ->pluck('price', 'symbol');

        $result = [];
        $missing = [];
        foreach ($symbols as $s) {
            $price = $rows[$s] ?? null;
            if ($price !== null && (float) $price > 0) {
                $result[$s] = (float) $price;
            } else {
                $missing[] = $s;
            }
        }

        foreach ($missing as $symbol) {
            $price = $this->fetchFromYahoo($symbol);
            if ($price !== null) {
                $result[$symbol] = $price;
            }
        }

        return $result;
    }

    protected function fetchFromYahoo(string $symbol): ?float
    {
        $url = "https://query1.finance.yahoo.com/v8/finance/chart/{$symbol}?interval=1d&range=5d";
        try {
            $raw = $this->client->get($url)->getBody()->getContents();
            $json = json_decode($raw, true);

            if (!isset($json['chart']['result'][0])) {
                return null;
            }

            $result = $json['chart']['result'][0];
            $quotes = $result['indicators']['quote'][0] ?? null;
            if (!$quotes || empty($quotes['close'])) {
                return null;
            }

            $closes = array_filter($quotes['close'], fn ($v) => $v !== null && $v > 0);
            return !empty($closes) ? (float) end($closes) : null;
        } catch (\Throwable $e) {
            return null;
        }
    }
}
