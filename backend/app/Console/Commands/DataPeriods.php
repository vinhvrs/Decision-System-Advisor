<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Platform\Plugins\Trading\Src\Models\InstrumentData;
use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;
use Platform\Plugins\Trading\Src\Models\Instruments;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class DataPeriods extends Command
{
    protected $signature = 'data:periods';
    protected $description = 'Fetch and store new data periods for instruments only if newer than latest timestamp';
    private $symbols = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA',
        'META', 'NVDA', 'JPM', 'V', 'UNH',];

    public function handle()
    {
        Log::info('[Schedule] Incremental DataPeriods started');
        $this->info('📡 Incremental update of data periods...');

        $instruments = Instruments::query()->whereIn('symbol', $this->symbols)->get();

        foreach ($instruments as $instrument) {
            $symbol = $instrument->symbol;
            if (empty($symbol)) {
                Log::warning('[Schedule] Instrument ID ' . $instrument->id . ' has no symbol, skipping.');
                $this->warn("⚠️ Instrument ID {$instrument->id} has no symbol, skipping.");
                continue;
            }
            // Create or get InstrumentPeriod
            $period = InstrumentPeriods::firstOrCreate([
                'instrument_id' => $instrument->id,
                'period' => 'daily',
                'market' => 'stock',
                'slug' => strtolower($symbol) . '-daily',
                'prefix' => strtolower($symbol),
            ]);
            $period->save();

            // Get latest timestamp from DB
            $latest = InstrumentData::where('instrument_period_id', $period->id)
                ->select('timestamps')
                ->orderByDesc('timestamps')
                ->limit(1)
                ->first();

            $latestTs = $latest ? $latest->getAttribute('timestamps') : null;

            $period1 = $latestTs
                ? Carbon::parse($latestTs)->timestamp
                : Carbon::createFromDate(2000, 1, 1)->timestamp;

            $period2 = now()->timestamp;

            // Fetch from Yahoo
            $url = "https://query2.finance.yahoo.com/v8/finance/chart/$symbol";
            $response = Http::get($url, [
                'interval' => '1d',
                'period1' => $period1,
                'period2' => $period2,
            ]);

            if (!$response->successful()) {
                $this->error("❌ Failed to fetch $symbol");
                continue;
            }

            $data = $response->json();
            if (!isset($data['chart']['result'][0]['timestamp'])) {
                $this->warn("⚠️ No new data for $symbol");
                continue;
            }

            $timestamps = $data['chart']['result'][0]['timestamp'];
            $quotes = $data['chart']['result'][0]['indicators']['quote'][0];

            foreach ($timestamps as $i => $ts) {
                $timestamp = Carbon::createFromTimestamp($ts, 'UTC')->format('Y-m-d 14:30:00');

                InstrumentData::updateOrCreate(
                    [
                        'instrument_period_id' => $period->id,
                        'timestamps' => $timestamp,
                    ],
                    [
                        'open' => $quotes['open'][$i] ?? null,
                        'high' => $quotes['high'][$i] ?? null,
                        'low' => $quotes['low'][$i] ?? null,
                        'close' => $quotes['close'][$i] ?? null,
                        'volume' => $quotes['volume'][$i] ?? null,
                        'source' => 'yahoo_finance',
                        'slug' => strtolower($symbol) . '-' . $timestamp,
                    ]
                );
                Log::info('[Schedule] DataPeriods inserted/updated data for ' . $symbol . ' at ' . $timestamp);
                // Log::info('data: ' . json_encode([
                //     'instrument_period_id' => $period->id,
                //     'timestamps' => $timestamp,
                //     'open' => $quotes['open'][$i] ?? null,
                //     'high' => $quotes['high'][$i] ?? null,
                //     'low' => $quotes['low'][$i] ?? null,
                //     'close' => $quotes['close'][$i] ?? null,
                //     'volume' => $quotes['volume'][$i] ?? null,
                //     'source' => 'yahoo_finance',
                //     'slug' => strtolower($symbol) . '-' . $timestamp,
                // ]));
            }
        }

        $this->info('DataPeriods incremental update complete.');
    }
}
