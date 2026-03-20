<?php
namespace Platform\Plugins\Trading\Src\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Schema;
use Platform\Plugins\Trading\Src\Models\Instruments;

class SnapshotService
{
    protected string $heatmapKey = 'heatmap:daily';
    protected string $marketCapRankingKey = 'marketcap:ranking:daily';
    protected string $liquidityRankingKey = 'liquidity:ranking:daily';
    protected string $changeRankingKey = 'heatmap:ranking:change';

    public function updateFromDailyCandle(int $instrumentId): void
    {
        $row = DB::table('instrument_data as d')
            ->join('instrument_periods as p', 'p.id', '=', 'd.instrument_period_id')
            ->where('p.period', 'daily')
            ->where('p.instrument_id', $instrumentId)
            ->orderByDesc('d.timestamps')
            ->limit(1)
            ->select(
                'd.open',
                'd.close',
                'd.volume',
                'p.instrument_id'
            )
            ->first();

        if (!$row || (float) $row->open <= 0) {
            return;
        }

        $instrument = Instruments::query()
            ->select('id', 'symbol')
            ->find($instrumentId);

        if (!$instrument) {
            return;
        }

        $symbol = strtoupper(trim((string) $instrument->symbol));
        $open = (float) $row->open;
        $price = (float) $row->close;
        $volume = (float) ($row->volume ?? 0);
        $changePct = (($price - $open) / $open) * 100;
        $liquidity = $price * $volume;

        DB::table('instrument_snapshot')->updateOrInsert(
            ['instrument_id' => $instrumentId],
            [
                'symbol' => $symbol,
                'price' => $price,
                'open' => $open,
                'volume' => $volume,
                'change_pct' => round($changePct, 2),
                'liquidity' => $liquidity,
                'updated_at' => now(),
            ]
        );
    }

    public function companyProfile(string $symbol = '', string $name = '')
    {
        $symbol = strtoupper(trim($symbol));
        $name = trim($name);

        if ($symbol !== '') {
            $profile = DB::table('company_profile')
                ->where('symbol', $symbol)
                ->first();

            if ($profile) {
                return $profile;
            }
        }

        if ($name !== '') {
            return DB::table('company_profile')
                ->where('company_name', $name)
                ->first();
        }

        return null;
    }

    public function topLiquidity(int $limit = 100): array
    {
        $limit = $this->sanitizeLimit($limit);

        $rows = $this->getSortedSetRanking(
            $this->liquidityRankingKey,
            $limit,
            true,
            'liquidity'
        );

        if (!empty($rows)) {
            return $rows;
        }

        return DB::table('instrument_snapshot')
            ->orderByDesc('liquidity')
            ->limit($limit)
            ->get(['symbol', 'liquidity'])
            ->map(fn ($row) => [
                'symbol' => strtoupper((string) $row->symbol),
                'liquidity' => (float) $row->liquidity,
            ])
            ->toArray();
    }

    public function bottomLiquidity(int $limit = 100): array
    {
        $limit = $this->sanitizeLimit($limit);

        $rows = $this->getSortedSetRanking(
            $this->liquidityRankingKey,
            $limit,
            false,
            'liquidity'
        );

        if (!empty($rows)) {
            return $rows;
        }

        return DB::table('instrument_snapshot')
            ->orderBy('liquidity')
            ->limit($limit)
            ->get(['symbol', 'liquidity'])
            ->map(fn ($row) => [
                'symbol' => strtoupper((string) $row->symbol),
                'liquidity' => (float) $row->liquidity,
            ])
            ->toArray();
    }

    public function topGainers(int $limit = 20): array
    {
        $limit = $this->sanitizeLimit($limit);

        $rows = $this->getSortedSetRanking(
            $this->changeRankingKey,
            $limit,
            true,
            'change_pct'
        );

        if (!empty($rows)) {
            return $rows;
        }

        return DB::table('instrument_snapshot')
            ->orderByDesc('change_pct')
            ->limit($limit)
            ->get(['symbol', 'change_pct'])
            ->map(fn ($row) => [
                'symbol' => strtoupper((string) $row->symbol),
                'change_pct' => (float) $row->change_pct,
            ])
            ->toArray();
    }

    public function topLosers(int $limit = 20): array
    {
        $limit = $this->sanitizeLimit($limit);

        $rows = $this->getSortedSetRanking(
            $this->changeRankingKey,
            $limit,
            false,
            'change_pct'
        );

        if (!empty($rows)) {
            return $rows;
        }

        return DB::table('instrument_snapshot')
            ->orderBy('change_pct')
            ->limit($limit)
            ->get(['symbol', 'change_pct'])
            ->map(fn ($row) => [
                'symbol' => strtoupper((string) $row->symbol),
                'change_pct' => (float) $row->change_pct,
            ])
            ->toArray();
    }

    public function topMarketCap(int $limit = 100): array
    {
        $limit = $this->sanitizeLimit($limit);

        $rows = $this->getSortedSetRanking(
            $this->marketCapRankingKey,
            $limit,
            true,
            'market_cap'
        );

        if (!empty($rows)) {
            return $rows;
        }

        return DB::table('instrument_snapshot')
            ->orderByDesc('market_cap')
            ->limit($limit)
            ->get(['symbol', 'market_cap'])
            ->map(fn ($row) => [
                'symbol' => strtoupper((string) $row->symbol),
                'market_cap' => (float) $row->market_cap,
            ])
            ->toArray();
    }

    public function heatmapDaily(int $limit = 100): array
    {
        $limit = $this->sanitizeLimit($limit);

        $data = Redis::connection()->hgetall($this->heatmapKey);

        if (!empty($data)) {
            return collect($data)
                ->map(fn ($row) => json_decode($row, true))
                ->filter(fn ($row) => is_array($row) && !empty($row['symbol']))
                ->sortByDesc(fn ($row) => (float) ($row['liquidity'] ?? 0))
                ->take($limit)
                ->map(function ($row) {
                    $marketCap = (float) ($row['market_cap'] ?? 0);
                    $changePct = (float) ($row['change_pct'] ?? 0);
                    $symbol = strtoupper((string) ($row['symbol'] ?? ''));

                    return [
                        'symbol' => $symbol,
                        'name' => $row['name'] ?? $symbol,
                        'price' => (float) ($row['price'] ?? 0),
                        'market_cap' => $marketCap,
                        'liquidity' => (float) ($row['liquidity'] ?? 0),
                        'change_pct' => round($changePct, 2),
                        'size' => isset($row['size']) ? (float) $row['size'] : $this->calcSize($marketCap),
                        'color' => $row['color'] ?? $this->calcColor($changePct),
                    ];
                })
                ->values()
                ->toArray();
        }

        $topSnapshots = DB::table('instrument_snapshot as s')
            ->select([
                's.instrument_id',
                's.symbol',
                's.price',
                's.open',
                's.volume',
                's.market_cap',
                's.liquidity',
                's.change_pct',
            ])
            ->orderByDesc('s.liquidity')
            ->limit($limit);

        return DB::query()
            ->fromSub($topSnapshots, 't')
            ->leftJoin('company_profile as cp', 'cp.symbol', '=', 't.symbol')
            ->select([
                't.instrument_id',
                't.symbol',
                DB::raw('COALESCE(cp.company_name, t.symbol) as name'),
                't.price',
                't.open',
                't.volume',
                't.market_cap',
                't.liquidity',
                't.change_pct',
            ])
            ->get()
            ->map(function ($row) {
                $marketCap = (float) ($row->market_cap ?? 0);
                $changePct = (float) ($row->change_pct ?? 0);

                return [
                    'instrument_id' => (int) $row->instrument_id,
                    'symbol' => strtoupper((string) $row->symbol),
                    'name' => $row->name ?: strtoupper((string) $row->symbol),
                    'price' => (float) ($row->price ?? 0),
                    'open' => (float) ($row->open ?? 0),
                    'volume' => (float) ($row->volume ?? 0),
                    'market_cap' => $marketCap,
                    'liquidity' => (float) ($row->liquidity ?? 0),
                    'change_pct' => round($changePct, 2),
                    'size' => $this->calcSize($marketCap),
                    'color' => $this->calcColor($changePct),
                ];
            })
            ->toArray();
    }

    public function topCompanies(int $limit = 100, string $orderBy = 'market_cap'): array
    {
        $limit = $this->sanitizeLimit($limit);
        $orderBy = $this->sanitizeOrderBy($orderBy);

        $redisKey = match ($orderBy) {
            'market_cap' => $this->marketCapRankingKey,
            'liquidity' => $this->liquidityRankingKey,
            'change_pct' => $this->changeRankingKey,
            default => null,
        };

        if ($redisKey) {
            $symbols = $this->getSortedSetSymbols($redisKey, $limit, true);

            if (!empty($symbols)) {
                $rows = DB::table('instrument_snapshot as s')
                    ->leftJoin('company_profile as cp', 'cp.symbol', '=', 's.symbol')
                    ->whereIn('s.symbol', $symbols)
                    ->select([
                        DB::raw('COALESCE(cp.company_name, s.symbol) as company_name'),
                        's.symbol',
                        's.price',
                        's.change_pct',
                        's.liquidity',
                        's.volume',
                        's.market_cap',
                    ])
                    ->get()
                    ->keyBy(fn ($row) => strtoupper((string) $row->symbol));

                $result = [];
                foreach ($symbols as $symbol) {
                    $key = strtoupper((string) $symbol);
                    if (!isset($rows[$key])) {
                        continue;
                    }

                    $row = $rows[$key];
                    $result[] = [
                        'company_name' => $row->company_name,
                        'symbol' => strtoupper((string) $row->symbol),
                        'price' => (float) ($row->price ?? 0),
                        'change_pct' => (float) ($row->change_pct ?? 0),
                        'liquidity' => (float) ($row->liquidity ?? 0),
                        'volume' => (float) ($row->volume ?? 0),
                        'market_cap' => (float) ($row->market_cap ?? 0),
                    ];
                }

                return $result;
            }
        }

        $topSnapshots = DB::table('instrument_snapshot as s')
            ->select([
                's.symbol',
                's.price',
                's.change_pct',
                's.liquidity',
                's.volume',
                's.market_cap',
            ])
            ->orderByDesc("s.$orderBy")
            ->limit($limit);

        return DB::query()
            ->fromSub($topSnapshots, 't')
            ->leftJoin('company_profile as cp', 'cp.symbol', '=', 't.symbol')
            ->select([
                DB::raw('COALESCE(cp.company_name, t.symbol) as company_name'),
                't.symbol',
                't.price',
                't.change_pct',
                't.liquidity',
                't.volume',
                't.market_cap',
            ])
            ->orderByDesc("t.$orderBy")
            ->get()
            ->map(fn ($row) => [
                'company_name' => $row->company_name,
                'symbol' => strtoupper((string) $row->symbol),
                'price' => (float) ($row->price ?? 0),
                'change_pct' => (float) ($row->change_pct ?? 0),
                'liquidity' => (float) ($row->liquidity ?? 0),
                'volume' => (float) ($row->volume ?? 0),
                'market_cap' => (float) ($row->market_cap ?? 0),
            ])
            ->toArray();
    }

    /**
     * Snapshot + community stats for beginner-friendly pages (no heavy jargon).
     */
    public function beginnerOverview(string $symbol): ?array
    {
        $sym = strtoupper(trim($symbol));
        if ($sym === '') {
            return null;
        }

        $q = DB::table('instrument_snapshot as s')
            ->whereRaw('UPPER(TRIM(s.symbol)) = ?', [$sym]);

        if (Schema::hasTable('company_profile')) {
            $cpSub = DB::table('company_profile')
                ->select([
                    DB::raw('UPPER(TRIM(symbol)) as symbol_key'),
                    DB::raw('MAX(company_name) as company_name'),
                    DB::raw('MAX(market_cap) as market_cap'),
                ])
                ->groupBy(DB::raw('UPPER(TRIM(symbol))'));

            $q->leftJoinSub($cpSub, 'cp', function ($join) {
                $join->whereRaw('cp.symbol_key = UPPER(TRIM(s.symbol))');
            })
                ->select([
                    's.symbol',
                    's.price',
                    's.open',
                    's.volume',
                    's.liquidity',
                    's.change_pct',
                    's.updated_at',
                    DB::raw('COALESCE(cp.company_name, s.symbol) as company_name'),
                    'cp.market_cap',
                ]);
        } else {
            $q->select([
                's.symbol',
                's.price',
                's.open',
                's.volume',
                's.liquidity',
                's.change_pct',
                's.updated_at',
                DB::raw('s.symbol as company_name'),
                DB::raw('NULL as market_cap'),
            ]);
        }

        $row = $q->first();

        if (!$row) {
            return null;
        }

        $peopleWatching = 0;
        if (Schema::hasTable('watchlist')) {
            try {
                $peopleWatching = (int) DB::table('watchlist')
                    ->whereRaw('UPPER(TRIM(symbol)) = ?', [$sym])
                    ->count();
            } catch (\Throwable) {
                $peopleWatching = 0;
            }
        }

        $reputation = match (true) {
            $peopleWatching >= 200 => 'high',
            $peopleWatching >= 50 => 'good',
            $peopleWatching >= 10 => 'growing',
            $peopleWatching >= 1 => 'small',
            default => 'quiet',
        };

        $reputation_label = match ($reputation) {
            'high' => 'Lots of people are following this symbol',
            'good' => 'Popular — many users have it on their watchlist',
            'growing' => 'Growing attention from our community',
            'small' => 'A smaller group is watching for now',
            default => 'Few watchlist saves yet — still under the radar',
        };

        $updatedAt = $row->updated_at;
        if ($updatedAt instanceof \DateTimeInterface) {
            $updatedAt = $updatedAt->format(\DateTimeInterface::ATOM);
        } elseif ($updatedAt !== null) {
            $updatedAt = (string) $updatedAt;
        }

        return [
            'symbol' => $sym,
            'company_name' => (string) $row->company_name,
            'price' => round((float) $row->price, 4),
            'day_open' => round((float) $row->open, 4),
            'volume' => round((float) $row->volume, 2),
            'liquidity' => round((float) $row->liquidity, 2),
            'change_pct_snapshot' => round((float) $row->change_pct, 2),
            'market_cap' => $row->market_cap !== null ? round((float) $row->market_cap, 2) : null,
            'snapshot_updated_at' => $updatedAt,
            'people_watching' => $peopleWatching,
            'reputation' => $reputation,
            'reputation_label' => $reputation_label,
        ];
    }

    /**
     * Beginner-friendly leaderboard: six 1–5 scores (reputation, price vs peers, candle-to-candle move,
     * volume, liquidity, people watching). Rank by how many scores are ≥ 4, then liquidity → volume → watchers.
     */
    public function beginnerRankingBoard(int $limit = 50): array
    {
        $limit = $this->sanitizeLimit($limit);

        if (Schema::hasTable('company_profile')) {
            $cpSub = DB::table('company_profile')
                ->select([
                    DB::raw('UPPER(TRIM(symbol)) as symbol_key'),
                    DB::raw('MAX(company_name) as company_name'),
                ])
                ->groupBy(DB::raw('UPPER(TRIM(symbol))'));

            $rows = DB::table('instrument_snapshot as s')
                ->leftJoinSub($cpSub, 'cp', function ($join) {
                    $join->whereRaw('cp.symbol_key = UPPER(TRIM(s.symbol))');
                })
                ->orderByDesc('s.liquidity')
                ->limit($limit)
                ->get([
                    's.instrument_id',
                    's.symbol',
                    's.price',
                    's.volume',
                    's.liquidity',
                    's.change_pct',
                    DB::raw('COALESCE(cp.company_name, s.symbol) as company_name'),
                ]);
        } else {
            $rows = DB::table('instrument_snapshot as s')
                ->orderByDesc('s.liquidity')
                ->limit($limit)
                ->get([
                    's.instrument_id',
                    's.symbol',
                    's.price',
                    's.volume',
                    's.liquidity',
                    's.change_pct',
                    DB::raw('s.symbol as company_name'),
                ]);
        }

        if ($rows->isEmpty()) {
            return [
                'axes' => $this->beginnerRadarAxisLabels(),
                'rows' => [],
                'legend' => [
                    'strong_rule' => 'A “strong” trait is a score of 4 or 5 (out of 5). Higher rank = more strong traits.',
                    'tie_break' => 'If two symbols have the same number of strong traits, we order by liquidity, then volume, then how many people saved the symbol.',
                    'buy_sell' => 'Green “Buy” / red “Sell” uses the same daily snapshot % change as our dashboard (up vs down). It is not financial advice.',
                ],
            ];
        }

        $symbols = $rows->pluck('symbol')->map(fn ($s) => strtoupper(trim((string) $s)))->unique()->values();

        $watchCounts = [];
        if (Schema::hasTable('watchlist') && $symbols->isNotEmpty()) {
            try {
                $slist = $symbols->map(fn ($s) => strtoupper(trim((string) $s)))->unique()->values()->all();
                $placeholders = implode(',', array_fill(0, count($slist), '?'));
                $sql = "SELECT UPPER(TRIM(symbol)) AS sym, COUNT(*) AS c FROM watchlist WHERE UPPER(TRIM(symbol)) IN ({$placeholders}) GROUP BY UPPER(TRIM(symbol))";
                $wrows = DB::select($sql, $slist);
                $watchCounts = collect($wrows)
                    ->mapWithKeys(fn ($r) => [strtoupper((string) $r->sym) => (int) $r->c])
                    ->all();
            } catch (\Throwable) {
                $watchCounts = [];
            }
        }

        $instrumentIds = $rows->pluck('instrument_id')->unique()->values()->all();
        $vsPrevAbsByInstrument = $this->beginnerVsPrevCloseAbsPct($instrumentIds);

        $bySymbol = [];
        foreach ($rows as $r) {
            $sym = strtoupper(trim((string) $r->symbol));
            $people = (int) ($watchCounts[$sym] ?? 0);
            $iid = (string) $r->instrument_id;
            $vsPrevAbs = $vsPrevAbsByInstrument[$iid] ?? null;
            $chg = abs((float) $r->change_pct);
            $candleMove = ($vsPrevAbs !== null && $vsPrevAbs > 0) ? $vsPrevAbs : $chg;

            $bySymbol[$sym] = [
                'instrument_id' => $iid,
                'company_name' => (string) $r->company_name,
                'price' => (float) $r->price,
                'volume' => (float) $r->volume,
                'liquidity' => (float) $r->liquidity,
                'change_pct' => (float) $r->change_pct,
                'people_watching' => $people,
                'candle_move_abs_pct' => round($candleMove, 4),
            ];
        }

        $priceScores = $this->quintileScoresBySymbol(collect($bySymbol)->mapWithKeys(
            fn ($d, $sym) => [$sym => $d['price']]
        )->all());

        $volScores = $this->quintileScoresBySymbol(collect($bySymbol)->mapWithKeys(
            fn ($d, $sym) => [$sym => $d['volume']]
        )->all());

        $liqScores = $this->quintileScoresBySymbol(collect($bySymbol)->mapWithKeys(
            fn ($d, $sym) => [$sym => $d['liquidity']]
        )->all());

        $peopleScores = $this->quintileScoresBySymbol(collect($bySymbol)->mapWithKeys(
            fn ($d, $sym) => [$sym => (float) $d['people_watching']]
        )->all());

        $candleScores = $this->quintileScoresBySymbol(collect($bySymbol)->mapWithKeys(
            fn ($d, $sym) => [$sym => $d['candle_move_abs_pct']]
        )->all());

        $ranked = [];
        foreach ($bySymbol as $sym => $d) {
            $repScore = $this->reputationScoreFromWatchers($d['people_watching']);

            $scores = [
                'reputation' => $repScore,
                'price_period' => (int) ($priceScores[$sym] ?? 3),
                'candle_change' => (int) ($candleScores[$sym] ?? 3),
                'volume' => (int) ($volScores[$sym] ?? 3),
                'liquidity' => (int) ($liqScores[$sym] ?? 3),
                'people_care' => (int) ($peopleScores[$sym] ?? 3),
            ];

            $strongCount = 0;
            foreach ($scores as $v) {
                if ($v >= 4) {
                    $strongCount++;
                }
            }

            $radar = [
                ['subject' => 'Reputation', 'value' => $scores['reputation']],
                ['subject' => 'Price vs peers', 'value' => $scores['price_period']],
                ['subject' => 'Candle change', 'value' => $scores['candle_change']],
                ['subject' => 'Volume', 'value' => $scores['volume']],
                ['subject' => 'Liquidity', 'value' => $scores['liquidity']],
                ['subject' => 'People care', 'value' => $scores['people_care']],
            ];

            $chg = round((float) $d['change_pct'], 2);

            $ranked[] = [
                'symbol' => $sym,
                'company_name' => $d['company_name'],
                'strong_count' => $strongCount,
                'scores' => $scores,
                'radar' => $radar,
                'liquidity' => round($d['liquidity'], 2),
                'volume' => round($d['volume'], 2),
                'people_watching' => $d['people_watching'],
                'price' => round($d['price'], 4),
                'candle_move_abs_pct' => $d['candle_move_abs_pct'],
                'change_pct_snapshot' => $chg,
                'day_bias' => $chg > 0 ? 'buy' : ($chg < 0 ? 'sell' : 'flat'),
            ];
        }

        usort($ranked, function (array $a, array $b): int {
            if ($a['strong_count'] !== $b['strong_count']) {
                return $b['strong_count'] <=> $a['strong_count'];
            }
            if ($a['liquidity'] != $b['liquidity']) {
                return $b['liquidity'] <=> $a['liquidity'];
            }
            if ($a['volume'] != $b['volume']) {
                return $b['volume'] <=> $a['volume'];
            }

            return $b['people_watching'] <=> $a['people_watching'];
        });

        foreach ($ranked as $i => &$row) {
            $row['rank'] = $i + 1;
        }
        unset($row);

        return [
            'axes' => $this->beginnerRadarAxisLabels(),
            'rows' => $ranked,
            'legend' => [
                'strong_rule' => 'A “strong” trait is a score of 4 or 5 (out of 5). Higher rank = more strong traits.',
                'tie_break' => 'If two symbols have the same number of strong traits, we order by liquidity, then volume, then how many people saved the symbol.',
                'buy_sell' => 'Green “Buy” / red “Sell” uses the same daily snapshot % change as our dashboard (up vs down). It is not financial advice.',
            ],
        ];
    }

    /**
     * @return array<string, float|null> instrument_id => abs % change last close vs previous daily close
     */
    protected function beginnerVsPrevCloseAbsPct(array $instrumentIds): array
    {
        $instrumentIds = array_values(array_filter(array_unique($instrumentIds)));
        if ($instrumentIds === []) {
            return [];
        }

        try {
            $placeholders = implode(',', array_fill(0, count($instrumentIds), '?'));
            $sql = "
                SELECT instrument_id,
                    MAX(CASE WHEN rn = 1 THEN c_last END) AS last_close,
                    MAX(CASE WHEN rn = 2 THEN c_last END) AS prev_close
                FROM (
                    SELECT d.instrument_id,
                        CAST(d.close AS DECIMAL(20,10)) AS c_last,
                        ROW_NUMBER() OVER (PARTITION BY d.instrument_id ORDER BY d.timestamps DESC) AS rn
                    FROM instrument_data AS d
                    INNER JOIN instrument_periods AS p ON p.id = d.instrument_period_id AND p.period = 'daily'
                    WHERE d.instrument_id IN ({$placeholders})
                ) AS z
                WHERE rn <= 2
                GROUP BY instrument_id
            ";

            $driver = DB::connection()->getDriverName();
            if ($driver === 'sqlite') {
                $sql = "
                    SELECT instrument_id,
                        MAX(CASE WHEN rn = 1 THEN c_last END) AS last_close,
                        MAX(CASE WHEN rn = 2 THEN c_last END) AS prev_close
                    FROM (
                        SELECT d.instrument_id,
                            CAST(d.close AS REAL) AS c_last,
                            ROW_NUMBER() OVER (PARTITION BY d.instrument_id ORDER BY d.timestamps DESC) AS rn
                        FROM instrument_data AS d
                        INNER JOIN instrument_periods AS p ON p.id = d.instrument_period_id AND p.period = 'daily'
                        WHERE d.instrument_id IN ({$placeholders})
                    ) AS z
                    WHERE rn <= 2
                    GROUP BY instrument_id
                ";
            }

            $got = DB::select($sql, $instrumentIds);
        } catch (\Throwable) {
            return [];
        }

        $out = [];
        foreach ($got as $row) {
            $iid = (string) $row->instrument_id;
            $last = isset($row->last_close) ? (float) $row->last_close : 0.0;
            $prev = isset($row->prev_close) ? (float) $row->prev_close : 0.0;
            if ($last > 0 && $prev > 0) {
                $out[$iid] = abs((($last - $prev) / $prev) * 100);
            }
        }

        return $out;
    }

    /**
     * Map watchlist count to 1–5 “reputation” (same buckets as beginner copy).
     */
    protected function reputationScoreFromWatchers(int $peopleWatching): int
    {
        return match (true) {
            $peopleWatching >= 200 => 5,
            $peopleWatching >= 50 => 4,
            $peopleWatching >= 10 => 3,
            $peopleWatching >= 1 => 2,
            default => 1,
        };
    }

    /**
     * @param  array<string, float>  $symbolToValue
     * @return array<string, int> symbol => 1..5 (higher = stronger vs this batch)
     */
    protected function quintileScoresBySymbol(array $symbolToValue): array
    {
        $pairs = [];
        foreach ($symbolToValue as $sym => $v) {
            if (!is_numeric($v) || !is_finite((float) $v)) {
                continue;
            }
            $pairs[] = ['sym' => (string) $sym, 'v' => (float) $v];
        }

        $n = count($pairs);
        if ($n === 0) {
            return [];
        }

        usort($pairs, fn (array $a, array $b): int => $a['v'] <=> $b['v']);

        $out = [];
        foreach ($pairs as $i => $item) {
            $pct = ($i + 0.5) / $n;
            $out[$item['sym']] = (int) max(1, min(5, (int) ceil($pct * 5)));
        }

        return $out;
    }

    /**
     * @return list<string>
     */
    protected function beginnerRadarAxisLabels(): array
    {
        return ['Reputation', 'Price vs peers', 'Candle change', 'Volume', 'Liquidity', 'People care'];
    }

    public function isLiquidSymbol(string $symbol, int $top = 100): bool
    {
        $symbol = strtoupper(trim($symbol));
        $top = max(1, (int) $top);

        $rank = Redis::connection()->zrevrank($this->liquidityRankingKey, $symbol);

        if ($rank !== null) {
            return $rank < $top;
        }

        $targetLiquidity = DB::table('instrument_snapshot')
            ->where('symbol', $symbol)
            ->value('liquidity');

        if ($targetLiquidity === null) {
            return false;
        }

        $countHigher = DB::table('instrument_snapshot')
            ->where('liquidity', '>', $targetLiquidity)
            ->count();

        return $countHigher < $top;
    }

    protected function sanitizeLimit(int $limit): int
    {
        if ($limit <= 0) {
            return 100;
        }

        return min($limit, 500);
    }

    protected function sanitizeOrderBy(string $orderBy): string
    {
        $allowed = ['market_cap', 'liquidity', 'change_pct', 'volume', 'price'];

        return in_array($orderBy, $allowed, true) ? $orderBy : 'market_cap';
    }

    protected function getSortedSetSymbols(string $key, int $limit, bool $desc = true): array
    {
        $method = $desc ? 'zrevrange' : 'zrange';

        $symbols = Redis::connection()->{$method}(
            $key,
            0,
            max(0, $limit - 1)
        );

        if (empty($symbols)) {
            return [];
        }

        return array_values(array_unique(array_map(
            fn ($symbol) => strtoupper(trim((string) $symbol)),
            $symbols
        )));
    }

    protected function getSortedSetRanking(string $key, int $limit, bool $desc, string $scoreField): array
    {
        $method = $desc ? 'zrevrange' : 'zrange';

        $data = Redis::connection()->{$method}(
            $key,
            0,
            max(0, $limit - 1),
            ['withscores' => true]
        );

        if (empty($data)) {
            return [];
        }

        return collect($data)
            ->map(function ($score, $symbol) use ($scoreField) {
                return [
                    'symbol' => strtoupper((string) $symbol),
                    $scoreField => (float) $score,
                ];
            })
            ->values()
            ->toArray();
    }

    protected function calcSize(float $marketCap): float
    {
        return round(log10(max($marketCap, 1)), 2);
    }

    protected function calcColor(float $change): string
    {
        return match (true) {
            $change >= 2.5 => '#27ae60',
            $change > 0 => '#9be7c4',
            $change <= -2.5 => '#c0392b',
            default => '#f5b7b1',
        };
    }
}