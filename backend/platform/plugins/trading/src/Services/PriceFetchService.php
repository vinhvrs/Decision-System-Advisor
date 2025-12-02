<?php

namespace Platform\Plugins\Trading\Src\Services;

use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

class PriceFetchService
{
    protected $client;
    protected $alphaKey;
    protected $finnKey;

    public function __construct()
    {
        $this->client = new Client([
            'timeout' => 10,
            'verify' => false,
        ]);
        $this->alphaKey = env('ALPHA_VANTAGE_API_KEY');
        $this->finnKey  = env('FINNHUB_API_KEY');
    }

    /**
     * FALLBACK:
     * YAHOO → ALPHA → FINN
     */
    public function fetchFallback(string $symbol, string $period)
    {
        if ($data = $this->fetchYahoo($symbol, $period)) {
            Log::info("Fetched data from Yahoo Finance for {$symbol} - {$period}");
            return ['source' => 'yahoo', 'data' => $data];
        }

        if ($data = $this->fetchAlpha($symbol, $period)) {
            Log::info("Fetched data from Alpha Vantage for {$symbol} - {$period}");
            return ['source' => 'alpha_vantage', 'data' => $data];
        }

        if ($data = $this->fetchFinnhub($symbol, $period)) {
            Log::info("Fetched data from Finnhub for {$symbol} - {$period}");
            return ['source' => 'finnhub', 'data' => $data];
        }

        return false;
    }

    /** -----------------------------
     *  YAHOO FINANCE PARSER
     *  ----------------------------*/
    private function fetchYahoo(string $symbol, string $period)
    {
        $map = [
            'daily' => '1d',
            'weekly' => '1wk',
            'monthly' => '1mo',
        ];
        if (!isset($map[$period])) return false;
        $url = "https://query1.finance.yahoo.com/v8/finance/chart/$symbol?interval={$map[$period]}&range=100y";
        try {
            $raw = $this->client->get($url)->getBody()->getContents();
            $json = json_decode($raw, true);

            if (!isset($json['chart']['result'][0])) return false;

            $result = $json['chart']['result'][0];
            $timestamps = $result['timestamp'] ?? [];
            $quotes = $result['indicators']['quote'][0];

            $rows = [];
            foreach ($timestamps as $i => $ts) {
                $rows[] = [
                    'timestamps' => date('Y-m-d H:i:s', $ts),
                    'open'       => $quotes['open'][$i] ?? null,
                    'high'       => $quotes['high'][$i] ?? null,
                    'low'        => $quotes['low'][$i] ?? null,
                    'close'      => $quotes['close'][$i] ?? null,
                    'volume'     => $quotes['volume'][$i] ?? null
                ];
            }

            return $rows;

        } catch (\Exception $e) {
            return false;
        }
    }


    /** -----------------------------
     *  ALPHA VANTAGE PARSER
     *  ----------------------------*/
    private function fetchAlpha(string $symbol, string $period)
    {
        $map = [
            'daily' => 'TIME_SERIES_DAILY',
            'weekly' => 'TIME_SERIES_WEEKLY',
            'monthly' => 'TIME_SERIES_MONTHLY',
        ];

        if (!isset($map[$period])) return false;

        $url = "https://www.alphavantage.co/query?function={$map[$period]}&symbol=$symbol&apikey={$this->alphaKey}";

        try {
            $json = json_decode($this->client->get($url)->getBody()->getContents(), true);

            // tìm series
            foreach ($json as $key => $series) {
                if (!str_contains($key, "Time Series")) continue;

                $rows = [];
                foreach ($series as $date => $candle) {
                    $rows[] = [
                        'timestamps' => $date . " 13:30:00", // chuẩn NYSE
                        'open'       => $candle['1. open'],
                        'high'       => $candle['2. high'],
                        'low'        => $candle['3. low'],
                        'close'      => $candle['4. close'],
                        'volume'     => $candle['5. volume'] ?? null,
                    ];
                }
                return $rows;
            }

            return false;

        } catch (\Exception $e) {
            return false;
        }
    }


    /** -----------------------------
     *  FINNHUB PARSER
     *  ----------------------------*/
    private function fetchFinnhub(string $symbol, string $period)
    {
        $map = [
            'daily' => 'D',
            'weekly' => 'W',
            'monthly' => 'M',
        ];

        if (!isset($map[$period])) return false;

        $to = time();
        $from = $to - (86400 * 365 * 2);

        $url = "https://finnhub.io/api/v1/stock/candle?symbol={$symbol}&resolution={$map[$period]}&from={$from}&to={$to}&token={$this->finnKey}";

        try {
            $json = json_decode($this->client->get($url)->getBody()->getContents(), true);

            if (($json['s'] ?? '') !== 'ok') return false;

            $rows = [];
            for ($i = 0; $i < count($json['t']); $i++) {
                $rows[] = [
                    'timestamps' => date('Y-m-d H:i:s', $json['t'][$i]),
                    'open'       => $json['o'][$i],
                    'high'       => $json['h'][$i],
                    'low'        => $json['l'][$i],
                    'close'      => $json['c'][$i],
                    'volume'     => $json['v'][$i] ?? null
                ];
            }
            return $rows;

        } catch (\Exception $e) {
            return false;
        }
    }
}
