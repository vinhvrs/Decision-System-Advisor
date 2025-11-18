<?php

namespace Platform\Plugins\Trading\Src\Services;

use Illuminate\Support\Facades\Log;
use Platform\Plugins\Trading\Src\Models\InstrumentData;
use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;
use GuzzleHttp\Client;

class HistoryFetchService
{
    protected Client $client;

    public function __construct()
    {
        $this->client = new Client(['verify' => false, 'timeout' => 20]);
    }

    /**
     * Fetch full HISTORY từ Yahoo từ đầu tới cuối
     */
    public function fetchFullHistory(string $symbol): array|bool
    {
        $url = "https://query1.finance.yahoo.com/v8/finance/chart/$symbol?interval=1d&range=max";

        Log::info("Yahoo FULL history URL: $url");

        try {
            $raw = $this->client->get($url)->getBody()->getContents();
            $json = json_decode($raw, true);

            if (!isset($json['chart']['result'][0])) {
                Log::warning("Yahoo returned empty full-history for $symbol");
                return false;
            }

            $res = $json['chart']['result'][0];
            $timestamps = $res['timestamp'] ?? [];
            $quotes = $res['indicators']['quote'][0];

            $rows = [];
            foreach ($timestamps as $i => $ts) {
                $rows[] = [
                    'timestamps' => date('Y-m-d H:i:s', $ts),
                    'open'      => $quotes['open'][$i] ?? null,
                    'high'      => $quotes['high'][$i] ?? null,
                    'low'       => $quotes['low'][$i] ?? null,
                    'close'     => $quotes['close'][$i] ?? null,
                    'volume'    => $quotes['volume'][$i] ?? null,
                ];
            }

            return $rows;

        } catch (\Throwable $e) {
            Log::error("Yahoo full history error: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Convert daily → weekly / monthly
     */
    public function aggregatePeriods(array $dailyRows): array
    {
        $weekly = [];
        $monthly = [];

        foreach ($dailyRows as $row) {
            $date = substr($row['timestamps'], 0, 10);
            $week = date('o-W', strtotime($row['timestamps']));
            $month = substr($date, 0, 7);

            // WEEKLY
            if (!isset($weekly[$week])) {
                $weekly[$week] = $row;
            } else {
                $weekly[$week]['high'] = max($weekly[$week]['high'], $row['high']);
                $weekly[$week]['low']  = min($weekly[$week]['low'], $row['low']);
                $weekly[$week]['close'] = $row['close'];
                $weekly[$week]['volume'] += $row['volume'];
            }

            // MONTHLY
            if (!isset($monthly[$month])) {
                $monthly[$month] = $row;
            } else {
                $monthly[$month]['high'] = max($monthly[$month]['high'], $row['high']);
                $monthly[$month]['low']  = min($monthly[$month]['low'], $row['low']);
                $monthly[$month]['close'] = $row['close'];
                $monthly[$month]['volume'] += $row['volume'];
            }
        }

        return [
            'daily' => $dailyRows,
            'weekly' => array_values($weekly),
            'monthly' => array_values($monthly),
        ];
    }

    /**
     * Lưu vào DB cho từng period
     */
    public function storeHistory($symbol, array $sets, array $periodIds)
    {
        $count = 0;

        foreach ($sets as $period => $rows) {
            $pid = $periodIds[$period];

            foreach ($rows as $row) {
                InstrumentData::updateOrCreate(
                    [
                        'instrument_period_id' => $pid,
                        'timestamps' => $row['timestamps'],
                    ],
                    [
                        'open' => $row['open'],
                        'high' => $row['high'],
                        'low'  => $row['low'],
                        'close'=> $row['close'],
                        'volume'=> $row['volume'],
                        'source'=> 'yahoo-full',
                        'slug'  => $symbol . '-' . $row['timestamps'],
                    ]
                );

                $count++;
            }
        }

        return $count;
    }
}
