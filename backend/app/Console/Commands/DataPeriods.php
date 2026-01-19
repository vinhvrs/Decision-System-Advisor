<?php

// namespace App\Console\Commands;

// use Carbon\Traits\Timestamp;
// use Illuminate\Console\Command;
// use Platform\Plugins\Trading\Src\Models\InstrumentData;
// use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;
// use Platform\Plugins\Trading\Src\Models\Instruments;
// use Illuminate\Support\Facades\Http;
// use Illuminate\Support\Facades\Log;
// use Carbon\Carbon;

// class DataPeriods extends Command
// {
//     protected $signature = 'data:periods';
//     protected $description = 'Fetch and store new data periods for instruments only if newer than latest timestamp';
//     private $symbols = [
//         'AAPL',
//         //'MSFT', 'GOOGL', 'AMZN', 'TSLA',
//         //'META', 'NVDA', 'JPM', 'V', 'UNH',
//     ];

//     public function handle()
//     {
//         Log::info('[Schedule] Incremental DataPeriods started');
//         $this->info('📡 Incremental update of data periods...');

//         $instruments = Instruments::query()->whereIn('symbol', $this->symbols)->get();

//         foreach ($instruments as $instrument) {
//             $symbol = $instrument->symbol;
//             if (empty($symbol)) {
//                 Log::warning('[Schedule] Instrument ID ' . $instrument->id . ' has no symbol, skipping.');
//                 $this->warn("⚠️ Instrument ID {$instrument->id} has no symbol, skipping.");
//                 continue;
//             }
//             // Create or get InstrumentPeriod
//             $daily = InstrumentPeriods::firstOrCreate([
//                 'instrument_id' => $instrument->id,
//                 'period' => 'daily',
//                 'market' => 'stock',
//                 'slug' => strtolower($symbol) . '-daily',
//                 'prefix' => strtolower($symbol),
//             ]);
//             $daily->save();

//             $weekly = InstrumentPeriods::firstOrCreate([
//                 'instrument_id' => $instrument->id,
//                 'period' => 'weekly',
//                 'market' => 'stock',
//                 'slug' => strtolower($symbol) . '-weekly',
//                 'prefix' => strtolower($symbol),
//             ]);
//             $weekly->save();

//             $monthly = InstrumentPeriods::firstOrCreate([
//                 'instrument_id' => $instrument->id,
//                 'period' => 'monthly',
//                 'market' => 'stock',
//                 'slug' => strtolower($symbol) . '-monthly',
//                 'prefix' => strtolower($symbol),
//             ]);
//             $monthly->save();

//             $yearly = InstrumentPeriods::firstOrCreate([
//                 'instrument_id' => $instrument->id,
//                 'period' => 'yearly',
//                 'market' => 'stock',
//                 'slug' => strtolower($symbol) . '-yearly',
//                 'prefix' => strtolower($symbol),
//             ]);
//             $yearly->save();

//             // Get latest timestamp from DB
//             $dailyLatest = InstrumentData::where('instrument_period_id', $daily->id)
//                 ->select('timestamps')
//                 ->orderByDesc('timestamps')
//                 ->limit(1)
//                 ->first();

//             $weeklyLatest = InstrumentData::where('instrument_period_id', $weekly->id)
//                 ->select('timestamps')
//                 ->orderByDesc('timestamps')
//                 ->limit(2)
//                 ->get();

//             $monthlyLatest = InstrumentData::where('instrument_period_id', $monthly->id)
//                 ->select('timestamps')
//                 ->orderByDesc('timestamps')
//                 ->limit(2)
//                 ->get();

//             $yearlyLatest = InstrumentData::where('instrument_period_id', $yearly->id)
//                 ->select('timestamps')
//                 ->orderByDesc('timestamps')
//                 ->limit(2)
//                 ->get();

//             $latestTs = $dailyLatest ? $dailyLatest->getAttribute('timestamps') : null;

//             $period1 = $latestTs
//                 ? Carbon::parse($latestTs)->timestamp
//                 : Carbon::createFromDate(1000, 1, 1)->timestamp;

//             $period2 = now()->timestamp;

//             // Fetch from Yahoo
//             $url = "https://query2.finance.yahoo.com/v8/finance/chart/$symbol";
//             $response = Http::get($url, [
//                 'interval' => '1d',
//                 'period1' => $period1,
//                 'period2' => $period2,
//             ]);

//             if (!$response->successful()) {
//                 $this->error("❌ Failed to fetch $symbol");
//                 continue;
//             }

//             $data = $response->json();
//             if (!isset($data['chart']['result'][0]['timestamp'])) {
//                 $this->warn("⚠️ No new data for $symbol");
//                 continue;
//             }

//             $timestamps = $data['chart']['result'][0]['timestamp'];
//             $quotes = $data['chart']['result'][0]['indicators']['quote'][0];

//             foreach ($timestamps as $i => $ts) {
//                 $timestamp = Carbon::createFromTimestamp($ts, 'UTC')->format('Y-m-d 14:30:00');

//                 InstrumentData::updateOrCreate(
//                     [
//                         'instrument_period_id' => $daily->id,
//                         'timestamps' => $timestamp,
//                         'slug' => strtolower($symbol) . '-' . $timestamp,
//                     ],
//                     [
//                         'open' => $quotes['open'][$i] ?? null,
//                         'high' => $quotes['high'][$i] ?? null,
//                         'low' => $quotes['low'][$i] ?? null,
//                         'close' => $quotes['close'][$i] ?? null,
//                         'volume' => $quotes['volume'][$i] ?? null,
//                         'source' => 'yahoo_finance',
//                         //'slug' => strtolower($symbol) . '-' . $timestamp,
//                     ]
//                 );
//                 Log::info('[Schedule] DataPeriods inserted/updated data for ' . $symbol . ' at ' . $timestamp);
//             }
//         }

//         $this->info('DataPeriods incremental update complete.');
//     }

//     public function cutDataByDateRange(array $data, Carbon $startDate, Carbon $endDate = null): array
//     {
//         $endDate = $endDate ?? now();
//         return array_filter($data, function ($item) use ($startDate, $endDate) {
//             $itemDate = Carbon::parse($item['timestamps']);
//             return $itemDate->between($startDate, $endDate);
//         });
//     }

//     public function dailyToWeekly(array $dailyData, Carbon $startDate, Carbon $endDate = null): array
//     {
//         $weeklyData = [];
//         $weekMap = [];
//         $dailyData = $this->cutDataByDateRange($dailyData, $startDate, $endDate);
//         foreach ($dailyData as $data) {
//             $date = Carbon::parse($data['timestamps']);
//             $weekStart = $date->startOfWeek()->format('Y-m-d');

//             if (!isset($weekMap[$weekStart])) {
//                 $weekMap[$weekStart] = [
//                     'timestamps' => $weekStart,
//                     'open' => $data['open'],
//                     'high' => $data['high'],
//                     'low' => $data['low'],
//                     'close' => $data['close'],
//                     'volume' => $data['volume'],
//                 ];
//             } else {
//                 $weekMap[$weekStart]['high'] = max($weekMap[$weekStart]['high'], $data['high']);
//                 $weekMap[$weekStart]['low'] = min($weekMap[$weekStart]['low'], $data['low']);
//                 $weekMap[$weekStart]['close'] = $data['close'];
//                 $weekMap[$weekStart]['volume'] += $data['volume'];
//             }
//         }

//         foreach ($weekMap as $weekData) {
//             $weeklyData[] = $weekData;
//         }

//         return $weeklyData;
//     }

//     public function newPeriodCandles($symbol, $period, Carbon $startDate, Carbon $endDate = null)
//     {
//         $endDate = $endDate ?? now();

//         switch ($period) {
//             case 'weekly':
//                 $startOfWeek = $startDate->copy()->startOfWeek();
//                 $endOfWeek = $startOfWeek->copy()->endOfWeek();
//                 return $endDate->greaterThanOrEqualTo($endOfWeek);
//             case 'monthly':
//                 $startOfMonth = $startDate->copy()->startOfMonth();
//                 $endOfMonth = $startOfMonth->copy()->endOfMonth();
//                 return $endDate->greaterThanOrEqualTo($endOfMonth);
//             case 'yearly':
//                 $startOfYear = $startDate->copy()->startOfYear();
//                 $endOfYear = $startOfYear->copy()->endOfYear();
//                 return $endDate->greaterThanOrEqualTo($endOfYear);
//             default:
//                 Log::warning("Unsupported period: $period");
//                 return false;
//         }
//     }

//     public function dailyToMonthly(array $dailyData, Carbon $startDate, Carbon $endDate = null): array
//     {
//         $monthlyData = [];
//         $monthMap = [];
//         $dailyData = $this->cutDataByDateRange($dailyData, $startDate, $endDate);

//         foreach ($dailyData as $data) {
//             $date = Carbon::parse($data['timestamps']);
//             $monthStart = $date->startOfMonth()->format('Y-m-d');

//             if (!isset($monthMap[$monthStart])) {
//                 $monthMap[$monthStart] = [
//                     'timestamps' => $monthStart,
//                     'open' => $data['open'],
//                     'high' => $data['high'],
//                     'low' => $data['low'],
//                     'close' => $data['close'],
//                     'volume' => $data['volume'],
//                 ];
//             } else {
//                 $monthMap[$monthStart]['high'] = max($monthMap[$monthStart]['high'], $data['high']);
//                 $monthMap[$monthStart]['low'] = min($monthMap[$monthStart]['low'], $data['low']);
//                 $monthMap[$monthStart]['close'] = $data['close'];
//                 $monthMap[$monthStart]['volume'] += $data['volume'];
//             }
//         }

//         foreach ($monthMap as $monthData) {
//             $monthlyData[] = $monthData;
//         }

//         return $monthlyData;
//     }

//     public function dailyToYearly(array $dailyData, Carbon $startDate, Carbon $endDate = null): array
//     {
//         $yearlyData = [];
//         $yearMap = [];

//         $dailyData = $this->cutDataByDateRange($dailyData, $startDate, $endDate);

//         foreach ($dailyData as $data) {
//             $date = Carbon::parse($data['timestamps']);
//             $yearStart = $date->startOfYear()->format('Y-m-d');

//             if (!isset($yearMap[$yearStart])) {
//                 $yearMap[$yearStart] = [
//                     'timestamps' => $yearStart,
//                     'open' => $data['open'],
//                     'high' => $data['high'],
//                     'low' => $data['low'],
//                     'close' => $data['close'],
//                     'volume' => $data['volume'],
//                 ];
//             } else {
//                 $yearMap[$yearStart]['high'] = max($yearMap[$yearStart]['high'], $data['high']);
//                 $yearMap[$yearStart]['low'] = min($yearMap[$yearStart]['low'], $data['low']);
//                 $yearMap[$yearStart]['close'] = $data['close'];
//                 $yearMap[$yearStart]['volume'] += $data['volume'];
//             }
//         }

//         foreach ($yearMap as $yearData) {
//             $yearlyData[] = $yearData;
//         }

//         return $yearlyData;
//     }

//     public function aggregateOHLCV($dataGroup)
//     {
//         $open = $dataGroup->first()['open'];
//         $close = $dataGroup->last()['close'];
//         $high = $dataGroup->max('high');
//         $low = $dataGroup->min('low');
//         $volume = $dataGroup->sum('volume');
//         $timestamp = $dataGroup->last()['timestamps'];

//         return [
//             'timestamps' => $timestamp,
//             'open' => $open,
//             'high' => $high,
//             'low' => $low,
//             'close' => $close,
//             'volume' => $volume,
//         ];
//     }

//     public function updateInstrumentDataPeriod($symbol, $instrumentId, $fromPeriod, $toPeriod, Carbon $startDate, Carbon $endDate = null)
//     {
//         $period = InstrumentPeriods::where('instrument_id', $instrumentId)
//             ->where('period', $fromPeriod)
//             ->first();

//         if (!$period) {
//             Log::warning("InstrumentPeriod not found for instrument ID $instrumentId and period $fromPeriod");
//             return;
//         }

//         $data = InstrumentData::where('instrument_period_id', $period->id)->get()->toArray();

//         switch ($fromPeriod . '_to_' . $toPeriod) {
//             case 'daily_to_weekly':
//                 $aggregatedData = $this->dailyToWeekly($data, $startDate, $endDate);
//                 foreach ($aggregatedData as $data) {
//                     $timestamp = $data['timestamps'];
//                     InstrumentData::updateOrCreate(
//                         [
//                             'instrument_period_id' => InstrumentPeriods::where('instrument_id', $instrumentId)
//                                 ->where('period', 'weekly')
//                                 ->first()
//                                 ->id,
//                             'timestamps' => $timestamp,
//                         ],
//                         [
//                             'open' => $data['open'],
//                             'high' => $data['high'],
//                             'low' => $data['low'],
//                             'close' => $data['close'],
//                             'volume' => $data['volume'],
//                             'source' => 'aggregated_from_daily',
//                             'slug' => strtolower($symbol) . '-' . $timestamp,
//                         ]
//                     );
//                 }
//                 break;
//             case 'daily_to_monthly':
//                 $aggregatedData = $this->dailyToMonthly($data, $startDate, $endDate);
//                 foreach ($aggregatedData as $data) {
//                     $timestamp = $data['timestamps'];
//                     InstrumentData::updateOrCreate(
//                         [
//                             'instrument_period_id' => InstrumentPeriods::where('instrument_id', $instrumentId)
//                                 ->where('period', 'monthly')
//                                 ->first()
//                                 ->id,
//                             'timestamps' => $timestamp,
//                         ],
//                         [
//                             'open' => $data['open'],
//                             'high' => $data['high'],
//                             'low' => $data['low'],
//                             'close' => $data['close'],
//                             'volume' => $data['volume'],
//                             'source' => 'aggregated_from_daily',
//                             'slug' => strtolower($symbol) . '-' . $timestamp,
//                         ]
//                     );
//                 }
//                 break;
//             case 'daily_to_yearly':
//                 $aggregatedData = $this->dailyToYearly($data, $startDate, $endDate);
//                 foreach ($aggregatedData as $data) {
//                     $timestamp = $data['timestamps'];
//                     InstrumentData::updateOrCreate(
//                         [
//                             'instrument_period_id' => InstrumentPeriods::where('instrument_id', $instrumentId)
//                                 ->where('period', 'yearly')
//                                 ->first()
//                                 ->id,
//                             'timestamps' => $timestamp,
//                         ],
//                         [
//                             'open' => $data['open'],
//                             'high' => $data['high'],
//                             'low' => $data['low'],
//                             'close' => $data['close'],
//                             'volume' => $data['volume'],
//                             'source' => 'aggregated_from_daily',
//                             'slug' => strtolower($symbol) . '-' . $timestamp,
//                         ]
//                     );
//                 }
//                 break;
//             default:
//                 Log::warning("Unsupported period conversion from $fromPeriod to $toPeriod");
//                 return;
//         }

//         Log::info("Aggregated " . count($aggregatedData) . " records from $fromPeriod to $toPeriod for instrument ID $instrumentId");

//         return $aggregatedData;
//     }


// }

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Platform\Plugins\Trading\Src\Models\InstrumentData;
use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;
use Platform\Plugins\Trading\Src\Models\Instruments;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Collection;
use Carbon\Carbon;

class DataPeriods extends Command
{
    protected $signature = 'data:periods';
    protected $description = 'Fetch and store new daily candles then aggregate to weekly/monthly/yearly (continuous).';

    private array $symbols = [
        'AAPL',
        // 'MSFT', 'GOOGL', 'AMZN', 'TSLA',
        // 'META', 'NVDA', 'JPM', 'V', 'UNH',
    ];

    /**
     * Minimum daily candles required to accept an aggregate candle.
     * Keep these not too strict due to holidays.
     */
    private int $minWeeklyCandles  = 3;   // typically 5, but holidays exist
    private int $minMonthlyCandles = 15;  // typically 20-22
    private int $minYearlyCandles  = 180; // typically 240-260

    public function handle()
    {
        Log::info('[Schedule] DataPeriods started');
        $this->info('📡 Incremental update of periods...');

        $instruments = Instruments::query()->whereIn('symbol', $this->symbols)->get();

        foreach ($instruments as $instrument) {
            $symbol = strtoupper((string) $instrument->symbol);
            if ($symbol === '') {
                Log::warning('[Schedule] Instrument ID ' . $instrument->id . ' has no symbol, skipping.');
                $this->warn("⚠️ Instrument ID {$instrument->id} has no symbol, skipping.");
                continue;
            }

            // Create or get periods
            [$daily, $weekly, $monthly, $yearly] = $this->ensurePeriods($instrument->id, $symbol);

            // Latest daily timestamp in DB
            $dailyLatest = InstrumentData::where('instrument_period_id', $daily->id)
                ->orderByDesc('timestamps')
                ->value('timestamps'); // string|nullable

            $period1 = $dailyLatest
                ? Carbon::parse($dailyLatest)->timestamp
                : Carbon::createFromDate(2000, 1, 1)->timestamp;

            $period2 = now()->timestamp;

            // Fetch daily candles from Yahoo
            $url = "https://query2.finance.yahoo.com/v8/finance/chart/$symbol";
            $response = Http::get($url, [
                'interval' => '1d',
                'period1' => $period1,
                'period2' => $period2,
            ]);

            if (!$response->successful()) {
                $this->error("❌ Failed to fetch $symbol");
                Log::warning("[Schedule] Yahoo fetch failed for $symbol, status=" . $response->status());
                continue;
            }

            $json = $response->json();
            $result = $json['chart']['result'][0] ?? null;

            if (!$result || !isset($result['timestamp'])) {
                $this->warn("⚠️ No new data for $symbol");
                continue;
            }

            $timestamps = $result['timestamp'] ?? [];
            $quotes = $result['indicators']['quote'][0] ?? [];

            if (empty($timestamps) || empty($quotes)) {
                $this->warn("⚠️ Empty data for $symbol");
                continue;
            }

            // Insert/Update daily candles
            $inserted = $this->upsertDailyFromYahoo($symbol, $daily->id, $timestamps, $quotes);

            $this->info("✅ $symbol daily upserted: $inserted candles");
            Log::info("[Schedule] $symbol daily upserted=$inserted");

            // Aggregate from DAILY (continuous, seamless)
            $this->refreshAggregatedPeriods(
                symbol: $symbol,
                dailyPeriodId: $daily->id,
                weeklyPeriodId: $weekly->id,
                monthlyPeriodId: $monthly->id,
                yearlyPeriodId: $yearly->id,
            );
        }

        $this->info('✅ DataPeriods update complete.');
        Log::info('[Schedule] DataPeriods finished');
    }

    // ========================= Core =========================

    private function ensurePeriods(string $instrumentId, string $symbol): array
    {
        $daily = InstrumentPeriods::firstOrCreate([
            'instrument_id' => $instrumentId,
            'period' => 'daily',
            'market' => 'stock',
            'slug' => strtolower($symbol) . '-daily',
            'prefix' => strtolower($symbol),
        ]);

        $weekly = InstrumentPeriods::firstOrCreate([
            'instrument_id' => $instrumentId,
            'period' => 'weekly',
            'market' => 'stock',
            'slug' => strtolower($symbol) . '-weekly',
            'prefix' => strtolower($symbol),
        ]);

        $monthly = InstrumentPeriods::firstOrCreate([
            'instrument_id' => $instrumentId,
            'period' => 'monthly',
            'market' => 'stock',
            'slug' => strtolower($symbol) . '-monthly',
            'prefix' => strtolower($symbol),
        ]);

        $yearly = InstrumentPeriods::firstOrCreate([
            'instrument_id' => $instrumentId,
            'period' => 'yearly',
            'market' => 'stock',
            'slug' => strtolower($symbol) . '-yearly',
            'prefix' => strtolower($symbol),
        ]);

        return [$daily, $weekly, $monthly, $yearly];
    }

    private function upsertDailyFromYahoo(string $symbol, string $dailyPeriodId, array $timestamps, array $quotes): int
    {
        $count = 0;

        foreach ($timestamps as $i => $ts) {
            // normalize to your fixed close time (keep your style)
            $timestampStr = Carbon::createFromTimestamp($ts, 'UTC')->format('Y-m-d 14:30:00');

            $open = $quotes['open'][$i] ?? null;
            $high = $quotes['high'][$i] ?? null;
            $low  = $quotes['low'][$i] ?? null;
            $close= $quotes['close'][$i] ?? null;
            $vol  = $quotes['volume'][$i] ?? null;

            // Skip if close is null (bad candle)
            if ($close === null) continue;

            InstrumentData::updateOrCreate(
                [
                    'instrument_period_id' => $dailyPeriodId,
                    'timestamps' => $timestampStr,
                ],
                [
                    'open' => $open,
                    'high' => $high,
                    'low' => $low,
                    'close' => $close,
                    'volume' => $vol,
                    'source' => 'yahoo_finance',
                    'slug' => strtolower($symbol) . '-' . $timestampStr,
                ]
            );

            $count++;
        }

        return $count;
    }

    /**
     * Build weekly/monthly/yearly candles from DAILY data and upsert.
     * Continuous: will also update the current (in-progress) period candle.
     */
    private function refreshAggregatedPeriods(
        string $symbol,
        string $dailyPeriodId,
        string $weeklyPeriodId,
        string $monthlyPeriodId,
        string $yearlyPeriodId
    ): void {
        // pull enough daily candles to cover multiple months/years
        $dailyRows = InstrumentData::where('instrument_period_id', $dailyPeriodId)
            ->orderBy('timestamps')
            ->limit(2000)
            ->get(['timestamps', 'open', 'high', 'low', 'close', 'volume']);

        if ($dailyRows->isEmpty()) {
            Log::warning("[Agg] No daily data for $symbol");
            return;
        }

        $weeklyAgg  = $this->aggregateFromDaily($dailyRows, 'weekly');
        $monthlyAgg = $this->aggregateFromDaily($dailyRows, 'monthly');
        $yearlyAgg  = $this->aggregateFromDaily($dailyRows, 'yearly');

        // Upsert (continuous). Keep min-candle guard.
        $this->upsertAggregates($symbol, $weeklyPeriodId,  $weeklyAgg,  'weekly',  $this->minWeeklyCandles);
        $this->upsertAggregates($symbol, $monthlyPeriodId, $monthlyAgg, 'monthly', $this->minMonthlyCandles);
        $this->upsertAggregates($symbol, $yearlyPeriodId,  $yearlyAgg,  'yearly',  $this->minYearlyCandles);

        Log::info("[Agg] Refreshed weekly/monthly/yearly for $symbol");
    }

    /**
     * Group daily candles into period buckets and compute OHLCV.
     * Output rows:
     * [
     *   'period_start' => 'YYYY-mm-dd',
     *   'period_end'   => 'YYYY-mm-dd',
     *   'count' => N,
     *   'open','high','low','close','volume'
     * ]
     */
    private function aggregateFromDaily(Collection $dailyRows, string $target): array
    {
        $groups = $dailyRows->groupBy(function ($r) use ($target) {
            $d = Carbon::parse($r->timestamps);

            return match ($target) {
                'weekly'  => $d->copy()->startOfWeek()->format('Y-m-d'),
                'monthly' => $d->copy()->startOfMonth()->format('Y-m-d'),
                'yearly'  => $d->copy()->startOfYear()->format('Y-m-d'),
                default   => $d->format('Y-m-d'),
            };
        });

        $out = [];

        foreach ($groups as $periodStart => $rows) {
            $rows = $rows->values();

            $first = $rows->first();
            $last  = $rows->last();

            // period end (for debug / completeness)
            $end = Carbon::parse($last->timestamps)->format('Y-m-d');

            $out[] = [
                'period_start' => $periodStart,
                'period_end' => $end,
                'count' => $rows->count(),
                'open' => (float) ($first->open ?? 0),
                'high' => (float) $rows->max('high'),
                'low'  => (float) $rows->min('low'),
                'close'=> (float) ($last->close ?? 0),
                'volume' => (float) $rows->sum('volume'),
            ];
        }

        usort($out, fn($a, $b) => strcmp($a['period_start'], $b['period_start']));
        return $out;
    }

    /**
     * Upsert aggregated candles into target period table.
     * - continuous: updates current period candle too
     * - minCandles: skip weak/incomplete periods (tunable)
     *
     * We store aggregated candle timestamps as period_start (YYYY-mm-dd).
     */
    private function upsertAggregates(
        string $symbol,
        string $targetPeriodId,
        array $aggregates,
        string $target,
        int $minCandles
    ): void {
        foreach ($aggregates as $candle) {
            $periodStart = $candle['period_start'];

            // require at least some daily candles
            if (($candle['count'] ?? 0) < $minCandles) {
                continue;
            }

            InstrumentData::updateOrCreate(
                [
                    'instrument_period_id' => $targetPeriodId,
                    'timestamps' => $periodStart,
                ],
                [
                    'open' => $candle['open'],
                    'high' => $candle['high'],
                    'low' => $candle['low'],
                    'close' => $candle['close'],
                    'volume' => $candle['volume'],
                    'source' => 'aggregated_from_daily',
                    'slug' => strtolower($symbol) . '-' . $periodStart,
                ]
            );
        }
    }
}
