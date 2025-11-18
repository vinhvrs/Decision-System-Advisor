<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;
use Platform\Plugins\Trading\Src\Models\InstrumentData;
use Platform\Plugins\Trading\Src\Models\Instruments;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class DataPeriods extends Command
{
    protected $signature = 'data:periods';

    protected $description = 'Fetch and store data periods for instruments';

    public function backup($symbol)
    {
        $response = Http::get("https://query2.finance.yahoo.com/v8/finance/chart/$symbol?", [
            'interval' => '1d',
            'period1' => '0',
            'period2' => '1758307200'
        ]);
        if ($response->successful()) {
            $data = $response->json();
            $timestampsData = [];

            $result = $data['chart']['result'][0];
            $timestamps = $result['timestamp'];
            $quotes = $result['indicators']['quote'][0];

            foreach ($timestamps as $i => $ts) {
                $timestampsData[] = [
                    'timestamps' => Carbon::createFromTimestamp($ts, 'UTC')
                        ->format('Y-m-d H:i:s'),
                    'open' => $quotes['open'][$i],
                    'high' => $quotes['high'][$i],
                    'low' => $quotes['low'][$i],
                    'close' => $quotes['close'][$i],
                    'volume' => $quotes['volume'][$i],
                ];
            }

            if (!empty($timestampsData)) {
                return json_encode($timestampsData);
            } else {
                $this->error("Failed to fetch data for symbol: $symbol");
                return [];
            }
        }

    }

    public function handle()
    {
        Log::info('[Schedule] schedule() method called');

        $this->info('📡 DataPeriods is running...');

        $instruments = Instruments::all();
        $symbols = $instruments->pluck('symbol')->toArray();
        $alpha_key = env('ALPHA_VANTAGE_API_KEY');
        $source = 'alpha_vantage';
        $data = [];

        foreach ($symbols as $symbol) {
            $this->info("Fetching data periods for symbol: $symbol");

            // $response = Http::get("https://www.alphavantage.co/query", [
            //     'function' => 'TIME_SERIES_DAILY',
            //     'symbol' => $symbol,
            //     'outputsize' => 'full',
            //     'apikey' => $alpha_key,
            // ]);
            // if ($response["Times Series (Daily)"]) {
            //     $response = $response["Times Series (Daily)"];
            // } else {
            //     $this->error("Failed to fetch data for symbol: $symbol");
            //     $this->error("We have detected your API key as $alpha_key and our standard API rate limit is 25 requests per day. Please subscribe to any of the premium plans at https://www.alphavantage.co/premium/ to instantly remove all daily rate limits.");
                $source = 'yahoo_finance';
                $response = $this->backup($symbol);

            // }

            if (empty($response)) {
                $this->error("No data found for symbol: $symbol");
                continue;
            }

            $data = json_decode($response, true);

            if (isset($data)) {
                $period = InstrumentPeriods::firstOrCreate([
                    'instrument_id' => $instruments->where('symbol', $symbol)->first()->id,
                    'period' => 'daily',
                    'market' => 'stock',
                    'slug' => strtolower($symbol) . '-daily',
                    'prefix' => strtolower($symbol),
                ]);

                $period->save();
                $periodId = InstrumentPeriods::where('slug', strtolower($symbol) . '-daily')->first()->id;

                foreach ($data as $date) {
                    InstrumentData::updateOrCreate(
                        [
                            'timestamps' => $date['timestamps'],
                            'instrument_period_id' => $periodId,
                        ],
                        [
                            'source' => 'alpha_vantage',
                            'open' => $date['open'],
                            'high' => $date['high'],
                            'low' => $date['low'],
                            'close' => $date['close'],
                            'volume' => $date['volume'],
                            'slug' => strtolower($symbol) . '-' . $date['timestamps'],
                        ]
                    );
                }
                $this->info("Data fetched successfully for symbol: $symbol");

            } else {
                $this->error("Failed to fetch data for symbol: $symbol");
            }
        }
        $this->info('✅ DataPeriods completed.');
    }
}