<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Platform\Plugins\Trading\Src\Models\InstrumentData;
use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;
use Platform\Plugins\Trading\Src\Models\Instruments;
use Platform\Plugins\Trading\Src\Services\SnapshotService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DataPeriods extends Command
{
    protected $signature = 'data:periods';
    protected $description = 'Incremental DAILY from Yahoo + chained aggregation: daily->weekly->monthly->yearly (low transfer).';

    private array $symbols = [
             'AAPL',
             'MSFT', 'GOOGL', 'AMZN', 'TSLA',
             'BRK-B', 'NVDA', 'META', 'UNH', 'JNJ',
             'V', 'PG', 'JPM', 'HD', 'MA',
    ];


    // Backfill window for incremental rebuild (tùy bạn chỉnh)
    private int $dailyBackfillDays = 20;
    private int $weeklyBackfillWeeks = 16;
    private int $monthlyBackfillMonths = 18;
    private int $yearlyBackfillYears = 8;
    private const SYMBOL_OK = 'ok';
    private const SYMBOL_ABORT = 'abort';


    // “baseline” cho logic DB (không dùng để gọi Yahoo)
    private string $minValidPeriodStart = '1000-01-01';

    // ---------- core ----------

    public function handle()
    {
        Log::info('[Schedule] DataPeriods started', ['db' => DB::connection()->getDatabaseName()]);

        $instruments = Instruments::query()
            ->whereIn('symbol', $this->symbols)
            ->get();

        foreach ($instruments as $instrument) {
            $symbol = strtoupper((string) $instrument->symbol);
            if ($symbol === '')
                continue;


            [$daily, $weekly, $monthly, $yearly] = $this->ensurePeriods((string) $instrument->id, $symbol);

            $latest = $this->getLatestTimestampsInDb((string) $daily->id, (string) $weekly->id, (string) $monthly->id, (string) $yearly->id);

            Log::info('[LatestTs]', [
                'symbol' => $symbol,
                'daily' => $latest['daily_latest'],
                'weekly' => $latest['weekly_latest'],
                'monthly' => $latest['monthly_latest'],
                'yearly' => $latest['yearly_latest'],
            ]);

            // 1) DAILY incremental
            [$status, $insertedDaily] =
                $this->updateDailyFromYahoo($symbol, (string) $daily->id, $latest['daily_latest']);

            if ($status === self::SYMBOL_ABORT) {
                Log::warning('[SymbolSkipped] Aborted due to invalid data', [
                    'symbol' => $symbol,
                ]);
                continue; // ⛔ KHÔNG snapshot, KHÔNG aggregate
            }
            Log::info("[Daily] $symbol upserted=$insertedDaily");
            app(SnapshotService::class)
                ->updateFromDailyCandle((string) $instrument->id);
            // refresh latest after daily
            $latestAfter = $this->getLatestTimestampsInDb((string) $daily->id, (string) $weekly->id, (string) $monthly->id, (string) $yearly->id);

            // 2) Chained aggregates
            $this->refreshWeeklyFromDaily($symbol, (string) $daily->id, (string) $weekly->id, $latestAfter['weekly_latest']);
            $this->refreshMonthlyFromWeekly($symbol, (string) $weekly->id, (string) $monthly->id, $latestAfter['monthly_latest']);
            $this->refreshYearlyFromMonthly($symbol, (string) $monthly->id, (string) $yearly->id, $latestAfter['yearly_latest']);

            Log::info("[Agg] Updated weekly/monthly/yearly for $symbol");
        }

        Log::info('[Schedule] DataPeriods finished');
        return self::SUCCESS;
    }

    // ---------- periods ----------

    private function ensurePeriods(string $instrumentId, string $symbol): array
    {
        // stable keys only
        $daily = InstrumentPeriods::firstOrCreate([
            'instrument_id' => $instrumentId,
            'period' => 'daily',
            'market' => 'stock',
        ]);
        $weekly = InstrumentPeriods::firstOrCreate([
            'instrument_id' => $instrumentId,
            'period' => 'weekly',
            'market' => 'stock',
        ]);
        $monthly = InstrumentPeriods::firstOrCreate([
            'instrument_id' => $instrumentId,
            'period' => 'monthly',
            'market' => 'stock',
        ]);
        $yearly = InstrumentPeriods::firstOrCreate([
            'instrument_id' => $instrumentId,
            'period' => 'yearly',
            'market' => 'stock',
        ]);

        // non-key fields update
        $daily->update(['slug' => strtolower($symbol) . '-daily', 'prefix' => strtolower($symbol)]);
        $weekly->update(['slug' => strtolower($symbol) . '-weekly', 'prefix' => strtolower($symbol)]);
        $monthly->update(['slug' => strtolower($symbol) . '-monthly', 'prefix' => strtolower($symbol)]);
        $yearly->update(['slug' => strtolower($symbol) . '-yearly', 'prefix' => strtolower($symbol)]);

        return [$daily, $weekly, $monthly, $yearly];
    }

    // ---------- Validation ----------
    private function isInvalidYahooCandle(array $q, int $i): bool
    {
        $fields = ['open', 'high', 'low', 'close'];

        foreach ($fields as $f) {
            if (!isset($q[$f][$i]))
                return true;

            $v = $q[$f][$i];

            if (!is_numeric($v))
                return true;
            if ($v <= 0)
                return true;

            // Yahoo sentinel / corrupted price
            if ($v >= 1_000_000_000)
                return true;
        }

        return false;
    }

    // ---------- timestamps helpers ----------

    private function buildTimeWindows(Carbon $start, Carbon $end): array
    {
        $windows = [];
        $cursor = $start->copy();

        while ($cursor->lt($end)) {
            $wStart = $cursor->copy();
            $wEnd = $cursor->copy()->addYears(15);

            if ($wEnd->gt($end)) {
                $wEnd = $end->copy();
            }

            $windows[] = [$wStart, $wEnd];
            $cursor = $wEnd->copy()->addDay();
        }

        return $windows;
    }

    private function strictCarbon($ts): ?Carbon
    {
        if ($ts instanceof \DateTimeInterface) {
            try {
                return Carbon::instance($ts);
            } catch (\Throwable $e) {
                return null;
            }
        }
        if (is_int($ts) || (is_string($ts) && ctype_digit($ts))) {
            try {
                return Carbon::createFromTimestamp((int) $ts, 'UTC');
            } catch (\Throwable $e) {
                return null;
            }
        }
        if (is_string($ts)) {
            $ts = trim($ts);
            if ($ts === '')
                return null;
            try {
                return Carbon::parse($ts);
            } catch (\Throwable $e) {
                return null;
            }
        }
        \Log::error('strictCarbon: unsupported type', ['type' => gettype($ts), 'value' => $ts]);
        return null;
    }

    private function normalizeDbTimestamp($value): ?string
    {
        $c = $this->strictCarbon($value);
        return $c ? $c->format('Y-m-d H:i:s') : null;
    }

    private function getLatestTimestampsInDb(string $dailyId, string $weeklyId, string $monthlyId, string $yearlyId): array
    {
        $dailyLatest = DB::table('instrument_data')->where('instrument_period_id', $dailyId)->max('timestamps');
        $weeklyLatest = DB::table('instrument_data')->where('instrument_period_id', $weeklyId)->max('timestamps');
        $monthlyLatest = DB::table('instrument_data')->where('instrument_period_id', $monthlyId)->max('timestamps');
        $yearlyLatest = DB::table('instrument_data')->where('instrument_period_id', $yearlyId)->max('timestamps');
        $periodStarts = DB::table('instrument_data')
            ->where('instrument_period_id', $dailyId)
            ->min('timestamps');
        $periodStarts = Carbon::parse($periodStarts ?? now());

        $weeklyLatest = $weeklyLatest
            ? $this->strictCarbon($weeklyLatest)
            : $periodStarts->copy()->startOfWeek(Carbon::MONDAY)->startOfDay();
        $monthlyLatest = $monthlyLatest
            ? $this->strictCarbon($monthlyLatest)
            : $periodStarts->copy()->startOfMonth()->startOfDay();
        $yearlyLatest = $yearlyLatest
            ? $this->strictCarbon($yearlyLatest)
            : $periodStarts->copy()->startOfYear()->startOfDay();

        return [
            'daily_latest' => $this->normalizeDbTimestamp($dailyLatest),
            'weekly_latest' => $this->normalizeDbTimestamp($weeklyLatest),
            'monthly_latest' => $this->normalizeDbTimestamp($monthlyLatest),
            'yearly_latest' => $this->normalizeDbTimestamp($yearlyLatest),
        ];
    }
    private function updateDailyFromYahoo(
        string $symbol,
        string $dailyPeriodId,
        ?string $latestDailyTs
    ): array {

        $start = $latestDailyTs
            ? Carbon::parse($latestDailyTs)->subDays($this->dailyBackfillDays)
            : Carbon::create(2000, 1, 1); // ⛔ chặn pre-2000

        $end = now();

        $windows = $this->buildTimeWindows($start, $end);
        $totalInserted = 0;

        foreach ($windows as [$wStart, $wEnd]) {

            try {
                $response = Http::retry(1, 500)
                    ->connectTimeout(5)
                    ->timeout(10)
                    ->get(
                        "https://query2.finance.yahoo.com/v8/finance/chart/$symbol",
                        [
                            'interval' => '1d',
                            'period1' => $wStart->timestamp,
                            'period2' => $wEnd->timestamp,
                        ]
                    );
            } catch (\Throwable $e) {
                Log::error('[YahooAbort] Timeout or connection error', [
                    'symbol' => $symbol,
                    'from' => $wStart->toDateString(),
                    'to' => $wEnd->toDateString(),
                    'error' => $e->getMessage(),
                ]);
                return [self::SYMBOL_ABORT, 0];
            }

            if (!$response->successful()) {
                Log::error('[YahooAbort] HTTP failed', [
                    'symbol' => $symbol,
                    'status' => $response->status(),
                ]);
                return [self::SYMBOL_ABORT, 0];
            }

            $body = $response->body();

            // ⛔ fail fast nếu JSON quá lớn
            if (strlen($body) > 5_000_000) {
                Log::error('[YahooAbort] Response too large', [
                    'symbol' => $symbol,
                    'bytes' => strlen($body),
                ]);
                return [self::SYMBOL_ABORT, 0];
            }

            try {
                $json = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
            } catch (\Throwable $e) {
                Log::error('[YahooAbort] JSON decode failed', [
                    'symbol' => $symbol,
                    'error' => $e->getMessage(),
                ]);
                return [self::SYMBOL_ABORT, 0];
            } finally {
                unset($body);
            }

            $result = $json['chart']['result'][0] ?? null;
            if (!$result) {
                continue; // window rỗng → không abort
            }

            $timestamps = $result['timestamp'] ?? [];
            $quotes = $result['indicators']['quote'][0] ?? [];

            foreach ($timestamps as $i => $ts) {

                // ⛔ validate timestamp
                if (!is_int($ts) && !ctype_digit((string) $ts)) {
                    Log::error('[YahooAbort] Invalid timestamp', [
                        'symbol' => $symbol,
                        'value' => $ts,
                    ]);
                    return [self::SYMBOL_ABORT, 0];
                }

                // ⛔ validate candle (price)
                if ($this->isInvalidYahooCandle($quotes, $i)) {
                    Log::error('[YahooAbort] Invalid candle detected', [
                        'symbol' => $symbol,
                        'timestamp' => $ts,
                    ]);
                    return [self::SYMBOL_ABORT, 0];
                }

                // ⛔ đảm bảo đồng bộ quote index
                if (
                    !isset(
                    $quotes['open'][$i],
                    $quotes['high'][$i],
                    $quotes['low'][$i],
                    $quotes['close'][$i]
                )
                ) {
                    Log::error('[YahooAbort] Quote index mismatch', [
                        'symbol' => $symbol,
                        'index' => $i,
                    ]);
                    return [self::SYMBOL_ABORT, 0];
                }

                $timestampStr = Carbon::createFromTimestamp((int) $ts, 'UTC')
                    ->format('Y-m-d 14:30:00'); // US market open

                InstrumentData::updateOrCreate(
                    [
                        'instrument_period_id' => $dailyPeriodId,
                        'timestamps' => $timestampStr,
                    ],
                    [
                        'open' => $quotes['open'][$i],
                        'high' => $quotes['high'][$i],
                        'low' => $quotes['low'][$i],
                        'close' => $quotes['close'][$i],
                        'volume' => $quotes['volume'][$i] ?? 0,
                        'source' => 'yahoo_finance',
                        'slug' => strtolower($symbol) . '-' . $timestampStr,
                    ]
                );

                $totalInserted++;
            }
        }

        return [self::SYMBOL_OK, $totalInserted];
    }

    // ---------- Aggregation (stream-like, low transfer) ----------

    private function refreshWeeklyFromDaily(string $symbol, string $dailyId, string $weeklyId, ?string $latestWeeklyTs): void
    {
        // start range: if null -> from first daily record; else backfill weeks
        $start = Carbon::parse($latestWeeklyTs);
        //? Carbon::parse($latestWeeklyTs)->copy()->subWeeks($this->weeklyBackfillWeeks)->startOfWeek(Carbon::MONDAY)->startOfDay()
        //: $this->getFirstTimestampOrNull($dailyId)?->copy()->startOfWeek(Carbon::MONDAY)->startOfDay();

        if (!$start)
            return;

        $rows = InstrumentData::query()
            ->where('instrument_period_id', '=', $dailyId)
            ->where('timestamps', '>=', $start->format('Y-m-d H:i:s'))
            ->orderBy('timestamps')
            ->get(['timestamps as timestamp', 'open', 'high', 'low', 'close', 'volume']);

        if ($rows->isEmpty())
            return;

        $groups = [];
        foreach ($rows as $r) {
            $t = $this->strictCarbon($r->timestamp);
            if (!$t)
                continue;
            $k = $t->copy()->startOfWeek(Carbon::MONDAY)->format('Y-m-d');
            if ($k < $this->minValidPeriodStart)
                continue;
            $groups[$k][] = $r;
        }

        foreach ($groups as $k => $bucket) {
            $first = $bucket[0];
            $last = $bucket[count($bucket) - 1];

            $open = (float) ($first->open ?? 0);
            $close = (float) ($last->close ?? 0);
            $high = (float) max(array_map(fn($x) => (float) ($x->high ?? 0), $bucket));
            $low = (float) min(array_map(fn($x) => (float) ($x->low ?? 0), $bucket));
            $vol = (float) array_sum(array_map(fn($x) => (float) ($x->volume ?? 0), $bucket));

            InstrumentData::updateOrCreate(
                [
                    'instrument_period_id' => $weeklyId,
                    'timestamps' => $k,
                ],
                [
                    'open' => $open,
                    'high' => $high,
                    'low' => $low,
                    'close' => $close,
                    'volume' => $vol,
                    'source' => 'aggregated_from_daily',
                    'slug' => strtolower($symbol) . '-' . $k,
                ]
            );
        }
    }

    private function refreshMonthlyFromWeekly(string $symbol, string $weeklyId, string $monthlyId, ?string $latestMonthlyTs): void
    {
        $start = Carbon::parse($latestMonthlyTs);
        // ? Carbon::parse($latestMonthlyTs)->copy()->subMonths($this->monthlyBackfillMonths)->startOfMonth()->startOfDay()
        // : $this->getFirstTimestampOrNull($weeklyId)?->copy()->startOfMonth()->startOfDay();

        if (!$start)
            return;

        $rows = InstrumentData::where('instrument_period_id', $weeklyId)
            ->where('timestamps', '>=', $start->format('Y-m-d'))
            ->orderBy('timestamps')
            ->get(['timestamps as timestamp', 'open', 'high', 'low', 'close', 'volume']);

        if ($rows->isEmpty())
            return;

        $groups = [];
        foreach ($rows as $r) {
            $t = $this->strictCarbon($r->timestamp);
            if (!$t)
                continue;
            $k = $t->copy()->startOfMonth()->format('Y-m-d');
            if ($k < $this->minValidPeriodStart)
                continue;
            $groups[$k][] = $r;
        }

        foreach ($groups as $k => $bucket) {
            $first = $bucket[0];
            $last = $bucket[count($bucket) - 1];

            $open = (float) ($first->open ?? 0);
            $close = (float) ($last->close ?? 0);
            $high = (float) max(array_map(fn($x) => (float) ($x->high ?? 0), $bucket));
            $low = (float) min(array_map(fn($x) => (float) ($x->low ?? 0), $bucket));
            $vol = (float) array_sum(array_map(fn($x) => (float) ($x->volume ?? 0), $bucket));

            InstrumentData::updateOrCreate(
                [
                    'instrument_period_id' => $monthlyId,
                    'timestamps' => $k,
                ],
                [
                    'open' => $open,
                    'high' => $high,
                    'low' => $low,
                    'close' => $close,
                    'volume' => $vol,
                    'source' => 'aggregated_from_weekly',
                    'slug' => strtolower($symbol) . '-' . $k,
                ]
            );
        }
    }

    private function refreshYearlyFromMonthly(string $symbol, string $monthlyId, string $yearlyId, ?string $latestYearlyTs): void
    {
        $start = Carbon::parse($latestYearlyTs);
        // ? Carbon::parse($latestYearlyTs)->copy()->subYears($this->yearlyBackfillYears)->startOfYear()->startOfDay()
        // : $this->getFirstTimestampOrNull($monthlyId)?->copy()->startOfYear()->startOfDay();

        if (!$start)
            return;

        $rows = InstrumentData::where('instrument_period_id', $monthlyId)
            ->where('timestamps', '>=', $start->format('Y-m-d'))
            ->orderBy('timestamps')
            ->get(['timestamps as timestamp', 'open', 'high', 'low', 'close', 'volume']);

        if ($rows->isEmpty())
            return;

        $groups = [];
        foreach ($rows as $r) {
            $t = $this->strictCarbon($r->timestamp);
            if (!$t)
                continue;
            $k = $t->copy()->startOfYear()->format('Y-m-d');
            if ($k < $this->minValidPeriodStart)
                continue;
            $groups[$k][] = $r;
        }

        foreach ($groups as $k => $bucket) {
            $first = $bucket[0];
            $last = $bucket[count($bucket) - 1];

            $open = (float) ($first->open ?? 0);
            $close = (float) ($last->close ?? 0);
            $high = (float) max(array_map(fn($x) => (float) ($x->high ?? 0), $bucket));
            $low = (float) min(array_map(fn($x) => (float) ($x->low ?? 0), $bucket));
            $vol = (float) array_sum(array_map(fn($x) => (float) ($x->volume ?? 0), $bucket));

            InstrumentData::updateOrCreate(
                [
                    'instrument_period_id' => $yearlyId,
                    'timestamps' => $k,
                ],
                [
                    'open' => $open,
                    'high' => $high,
                    'low' => $low,
                    'close' => $close,
                    'volume' => $vol,
                    'source' => 'aggregated_from_monthly',
                    'slug' => strtolower($symbol) . '-' . $k,
                ]
            );
        }
    }

    private function getFirstTimestampOrNull(string $periodId): ?Carbon
    {
        $first = DB::table('instrument_data')
            ->where('instrument_period_id', $periodId)
            ->orderBy('timestamps', 'asc')
            ->value('timestamps');

        return $this->strictCarbon($first);
    }
}
