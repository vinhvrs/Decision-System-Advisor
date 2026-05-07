<?php
namespace Platform\Plugins\Trading\Src\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Schema;
use Platform\Plugins\Trading\Src\Models\Instruments;

class SnapshotService
{
    /** Count a “strong” radar trait when its 1–5 score is >= this value (not 5). */
    private const BEGINNER_STRONG_TRAIT_MIN_SCORE = 4;
    /** Dashboard daily response should always show top 10 rows. */
    private const DASHBOARD_DAILY_LIMIT = 10;

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

    /**
     * Daily heatmap rows (Redis hash or DB fallback). Optional {@code $sector} filters by {@code company_profile.sector}
     * (case-insensitive substring, e.g. "Technology" matches "Information Technology").
     */
    public function heatmapDaily(int $limit = 100, ?string $sector = null): array
    {
        $limit = $this->sanitizeLimit($limit);
        $sector = $this->normalizeSectorFilter($sector);

        $data = [];
        try {
            $data = Redis::connection()->hgetall($this->heatmapKey);
        } catch (\Throwable $e) {
            report($e);
        }

        if (! empty($data)) {
            $rows = collect($data)
                ->map(fn ($row) => json_decode($row, true))
                ->filter(fn ($row) => is_array($row) && ! empty($row['symbol']));

            if ($sector !== null) {
                $symbols = $rows
                    ->map(fn ($row) => strtoupper(trim((string) ($row['symbol'] ?? ''))))
                    ->filter()
                    ->unique()
                    ->values()
                    ->all();
                $allowed = $this->symbolsAllowedForSectorFilter($symbols, $sector);
                $rows = $rows->filter(fn ($row) => in_array(
                    strtoupper(trim((string) ($row['symbol'] ?? ''))),
                    $allowed,
                    true
                ));
            }

            return $rows
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

        $cacheKey = 'heatmap_daily_db_'.$limit.'_'.sha1((string) $sector);

        return Cache::remember($cacheKey, now()->addSeconds(90), function () use ($limit, $sector) {
            return $this->heatmapDailyFromDatabase($limit, $sector);
        });
    }

    protected function normalizeSectorFilter(?string $sector): ?string
    {
        if ($sector === null) {
            return null;
        }
        $t = trim($sector);

        return $t === '' ? null : $t;
    }

    /**
     * @param  list<string>  $upperSymbols
     * @return list<string>
     */
    protected function symbolsAllowedForSectorFilter(array $upperSymbols, string $sectorNeedle): array
    {
        if ($upperSymbols === []) {
            return [];
        }
        $needle = mb_strtolower(trim($sectorNeedle));
        if ($needle === '') {
            return $upperSymbols;
        }

        $rows = DB::table('company_profile')
            ->whereIn(DB::raw('UPPER(TRIM(symbol))'), $upperSymbols)
            ->get(['symbol', 'sector']);

        $out = [];
        foreach ($rows as $r) {
            $sec = (string) ($r->sector ?? '');
            if ($sec === '') {
                continue;
            }
            if (mb_stripos(mb_strtolower($sec), $needle) !== false) {
                $out[] = strtoupper(trim((string) $r->symbol));
            }
        }

        return array_values(array_unique($out));
    }

    /**
     * Fallback when Redis heatmap hash is empty: read by liquidity; optional sector join on company_profile.
     */
    protected function heatmapDailyFromDatabase(int $limit, ?string $sector = null): array
    {
        $q = DB::table('instrument_snapshot as s')
            ->select([
                's.instrument_id',
                's.symbol',
                's.price',
                's.open',
                's.volume',
                's.market_cap',
                's.liquidity',
                's.change_pct',
            ]);

        if ($sector !== null && $sector !== '') {
            $needle = mb_strtolower(trim($sector));
            $q->join('company_profile as cp', function ($join) {
                $join->whereRaw('UPPER(TRIM(cp.symbol)) = UPPER(TRIM(s.symbol))');
            })
                ->whereNotNull('cp.sector')
                ->where('cp.sector', '!=', '')
                ->whereRaw('LOWER(cp.sector) LIKE ?', ['%'.$needle.'%']);
        }

        return $q->orderByDesc('s.liquidity')
            ->limit($limit)
            ->get()
            ->map(function ($row) {
                $marketCap = (float) ($row->market_cap ?? 0);
                $changePct = (float) ($row->change_pct ?? 0);
                $sym = strtoupper((string) $row->symbol);

                return [
                    'instrument_id' => (int) $row->instrument_id,
                    'symbol' => $sym,
                    'name' => $sym,
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
                $cpSub = $this->companyProfileByNormalizedSymbolSubquery();
                $q = DB::table('instrument_snapshot as s')
                    ->whereIn('s.symbol', $symbols)
                    ->select([
                        's.symbol',
                        's.price',
                        's.change_pct',
                        's.liquidity',
                        's.volume',
                        's.market_cap',
                    ]);

                if ($cpSub !== null) {
                    $q->leftJoinSub($cpSub, 'cp', function ($join) {
                        $join->whereRaw('cp.symbol_key = UPPER(TRIM(s.symbol))');
                    })
                        ->addSelect(DB::raw('COALESCE(cp.company_name, s.symbol) as company_name'));
                } else {
                    $q->addSelect(DB::raw('s.symbol as company_name'));
                }

                $metricPicker = $this->topCompaniesMetricPicker($orderBy);

                $rows = $q->get()
                    ->groupBy(fn ($row) => strtoupper(trim((string) $row->symbol)))
                    ->map(fn ($group) => $group->sortByDesc($metricPicker)->first());

                $result = [];
                foreach ($symbols as $symbol) {
                    $key = strtoupper((string) $symbol);
                    if (!$rows->has($key)) {
                        continue;
                    }

                    $row = $rows->get($key);
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

        $ranked = $this->instrumentSnapshotRankedBySymbolSubquery($orderBy);
        $deduped = DB::query()
            ->fromSub($ranked, 'r')
            ->where('r.rn', '=', 1);

        $cpSub = $this->companyProfileByNormalizedSymbolSubquery();

        $outer = DB::query()->fromSub($deduped, 't');

        if ($cpSub !== null) {
            $outer->leftJoinSub($cpSub, 'cp', function ($join) {
                $join->whereRaw('cp.symbol_key = UPPER(TRIM(t.symbol))');
            })
                ->select([
                    DB::raw('COALESCE(cp.company_name, t.symbol) as company_name'),
                    't.symbol',
                    't.price',
                    't.change_pct',
                    't.liquidity',
                    't.volume',
                    't.market_cap',
                ]);
        } else {
            $outer->select([
                DB::raw('t.symbol as company_name'),
                't.symbol',
                't.price',
                't.change_pct',
                't.liquidity',
                't.volume',
                't.market_cap',
            ]);
        }

        return $outer
            ->orderByDesc("t.$orderBy")
            ->limit($limit)
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
     * One row per normalized symbol for ranking: multiple instruments can share the same ticker.
     */
    protected function instrumentSnapshotRankedBySymbolSubquery(string $orderBy): \Illuminate\Database\Query\Builder
    {
        $orderColumnExpr = match ($orderBy) {
            'market_cap' => 's.market_cap',
            'liquidity' => 's.liquidity',
            'change_pct' => 's.change_pct',
            'volume' => 's.volume',
            'price' => 's.price',
            default => 's.market_cap',
        };

        return DB::table('instrument_snapshot as s')
            ->select([
                's.symbol',
                's.price',
                's.change_pct',
                's.liquidity',
                's.volume',
                's.market_cap',
                DB::raw("ROW_NUMBER() OVER (PARTITION BY UPPER(TRIM(s.symbol)) ORDER BY {$orderColumnExpr} DESC, s.updated_at DESC, s.instrument_id DESC) as rn"),
            ]);
    }

    /**
     * @return \Closure(object): float|int
     */
    protected function topCompaniesMetricPicker(string $orderBy): \Closure
    {
        return match ($orderBy) {
            'market_cap' => fn ($r) => (float) ($r->market_cap ?? 0),
            'liquidity' => fn ($r) => (float) ($r->liquidity ?? 0),
            'change_pct' => fn ($r) => (float) ($r->change_pct ?? 0),
            'volume' => fn ($r) => (float) ($r->volume ?? 0),
            'price' => fn ($r) => (float) ($r->price ?? 0),
            default => fn ($r) => (float) ($r->market_cap ?? 0),
        };
    }

    /**
     * Avoid duplicate rows when company_profile has multiple entries for the same ticker.
     */
    protected function companyProfileByNormalizedSymbolSubquery(): ?\Illuminate\Database\Query\Builder
    {
        if (! Schema::hasTable('company_profile')) {
            return null;
        }

        return DB::table('company_profile')
            ->select([
                DB::raw('UPPER(TRIM(symbol)) as symbol_key'),
                DB::raw('MAX(company_name) as company_name'),
            ])
            ->groupBy(DB::raw('UPPER(TRIM(symbol))'));
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
                    DB::raw('MAX(image) as company_logo'),
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
                    'cp.company_logo',
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

        $logo = isset($row->company_logo) && $row->company_logo !== null && trim((string) $row->company_logo) !== ''
            ? trim((string) $row->company_logo)
            : null;

        return [
            'symbol' => $sym,
            'company_name' => (string) $row->company_name,
            'logo_url' => $logo,
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
     * Top symbols by snapshot volume (for “most active” lists). Cached 3 hours — not real-time.
     *
     * Scans instrument_snapshot ordered by volume (highest first). Returns two lists: symbols with
     * positive change_pct and symbols with negative change_pct, each capped at $perList (min 5),
     * preserving volume order within each side.
     */
    public function topSymbolsByVolume(int $limit = 20): array
    {
        $minRows = $this->sanitizeLimit($limit);

        return Cache::remember(
            'ranking_top_volume_v3_'.$minRows,
            now()->addHours(3),
            fn () => $this->topSymbolsByVolumeUncached($minRows)
        );
    }

    protected function topSymbolsByVolumeUncached(int $minRows): array
    {
        $perList = max(5, min($minRows, 100));
        $fetchCap = min(500, max($perList * 8, 200));

        if (Schema::hasTable('company_profile')) {
            $cpSub = DB::table('company_profile')
                ->select([
                    DB::raw('UPPER(TRIM(symbol)) as symbol_key'),
                    DB::raw('MAX(company_name) as company_name'),
                    DB::raw('MAX(image) as company_logo'),
                ])
                ->groupBy(DB::raw('UPPER(TRIM(symbol))'));

            $rows = DB::table('instrument_snapshot as s')
                ->leftJoinSub($cpSub, 'cp', function ($join) {
                    $join->whereRaw('cp.symbol_key = UPPER(TRIM(s.symbol))');
                })
                ->orderByDesc('s.volume')
                ->limit($fetchCap)
                ->get([
                    's.symbol',
                    's.volume',
                    's.change_pct',
                    's.price',
                    's.liquidity',
                    DB::raw('COALESCE(cp.company_name, s.symbol) as company_name'),
                    'cp.company_logo',
                ]);
        } else {
            $rows = DB::table('instrument_snapshot as s')
                ->orderByDesc('s.volume')
                ->limit($fetchCap)
                ->get([
                    's.symbol',
                    's.volume',
                    's.change_pct',
                    's.price',
                    's.liquidity',
                    DB::raw('s.symbol as company_name'),
                    DB::raw('NULL as company_logo'),
                ]);
        }

        $out = [];
        foreach ($rows as $r) {
            $sym = strtoupper(trim((string) $r->symbol));
            $logo = isset($r->company_logo) && $r->company_logo !== null && trim((string) $r->company_logo) !== ''
                ? trim((string) $r->company_logo)
                : null;
            $out[] = [
                'symbol' => $sym,
                'company_name' => (string) $r->company_name,
                'logo_url' => $logo,
                'volume' => round((float) $r->volume, 2),
                'change_pct' => round((float) $r->change_pct, 4),
                'price' => round((float) $r->price, 4),
                'liquidity' => round((float) $r->liquidity, 2),
            ];
        }

        $gainers = [];
        $losers = [];
        foreach ($out as $row) {
            $ch = $row['change_pct'];
            if ($ch > 0 && count($gainers) < $perList) {
                $gainers[] = $row;
            } elseif ($ch < 0 && count($losers) < $perList) {
                $losers[] = $row;
            }
            if (count($gainers) >= $perList && count($losers) >= $perList) {
                break;
            }
        }

        $note = 'Two lists from the same volume-ranked snapshot: top '.$perList.' symbols with positive '
            .'change_pct and top '.$perList.' with negative change_pct (by volume among each side). '
            .'Refreshed at most every 3 hours.';

        return [
            'gainers' => $gainers,
            'losers' => $losers,
            'updated_note' => $note,
        ];
    }

    /**
     * Beginner-friendly leaderboard: pool = top N by snapshot volume (cached 3h). Six 1–5 scores in payload;
     * rank by strong traits among the five chart spokes (Signal, Change, Volume, Liquidity, Watchers — Price excluded),
     * then liquidity → volume → watchers.
     */
    public function beginnerRankingBoard(int $limit = 20): array
    {
        $limit = $this->sanitizeLimit($limit);

        return Cache::remember(
            'beginner_ranking_board_v6_'.$limit,
            now()->addHours(3),
            fn () => $this->beginnerRankingBoardUncached($limit)
        );
    }

    /**
     * Precomputed JSON from python_engine warm-up (`dashboard:daily` in the python_engine Redis DB).
     *
     * @return array<string, mixed>|null
     */
    public function dashboardDailyFromPythonRedis(): ?array
    {
        try {
            $raw = Redis::connection('python_engine')->get('dashboard:daily');
        } catch (\Throwable) {
            return null;
        }

        if (! is_string($raw) || $raw === '') {
            return null;
        }

        $data = json_decode($raw, true);
        if (! is_array($data)) {
            return null;
        }

        if (! isset($data['rows']) && isset($data['ranking_board'])) {
            $data['rows'] = $data['ranking_board'];
        }
        if (isset($data['rows']) && is_array($data['rows'])) {
            $data['rows'] = array_values(array_slice($data['rows'], 0, self::DASHBOARD_DAILY_LIMIT));
        }
        if (isset($data['ranking_board']) && is_array($data['ranking_board'])) {
            $data['ranking_board'] = array_values(array_slice($data['ranking_board'], 0, self::DASHBOARD_DAILY_LIMIT));
        }
        if (isset($data['meta']) && is_array($data['meta'])) {
            $data['meta']['row_count'] = isset($data['rows']) && is_array($data['rows']) ? count($data['rows']) : 0;
            $data['meta']['pool_limit'] = self::DASHBOARD_DAILY_LIMIT;
        }

        return $data;
    }

    /**
     * Top snapshot rows for beginner radar quintiles (same source as beginner board).
     */
    protected function queryTopSnapshotRowsForBeginnerRadar(int $limit): Collection
    {
        $limit = max(1, $limit);

        if (Schema::hasTable('company_profile')) {
            $cpSub = DB::table('company_profile')
                ->select([
                    DB::raw('UPPER(TRIM(symbol)) as symbol_key'),
                    DB::raw('MAX(company_name) as company_name'),
                    DB::raw('MAX(image) as company_logo'),
                ])
                ->groupBy(DB::raw('UPPER(TRIM(symbol))'));

            return DB::table('instrument_snapshot as s')
                ->leftJoinSub($cpSub, 'cp', function ($join) {
                    $join->whereRaw('cp.symbol_key = UPPER(TRIM(s.symbol))');
                })
                ->orderByDesc('s.volume')
                ->limit($limit)
                ->get([
                    's.instrument_id',
                    's.symbol',
                    's.price',
                    's.volume',
                    's.liquidity',
                    's.change_pct',
                    DB::raw('COALESCE(cp.company_name, s.symbol) as company_name'),
                    'cp.company_logo',
                ]);
        }

        return DB::table('instrument_snapshot as s')
            ->orderByDesc('s.volume')
            ->limit($limit)
            ->get([
                's.instrument_id',
                's.symbol',
                's.price',
                's.volume',
                's.liquidity',
                's.change_pct',
                DB::raw('s.symbol as company_name'),
                DB::raw('NULL as company_logo'),
            ]);
    }

    /**
     * One snapshot row for a symbol (same shape as queryTopSnapshotRowsForBeginnerRadar).
     */
    protected function querySingleSnapshotRowForBeginnerRadar(string $symbolUpper): ?object
    {
        $sym = strtoupper(trim($symbolUpper));
        if ($sym === '') {
            return null;
        }

        if (Schema::hasTable('company_profile')) {
            $cpSub = DB::table('company_profile')
                ->select([
                    DB::raw('UPPER(TRIM(symbol)) as symbol_key'),
                    DB::raw('MAX(company_name) as company_name'),
                    DB::raw('MAX(image) as company_logo'),
                ])
                ->groupBy(DB::raw('UPPER(TRIM(symbol))'));

            $row = DB::table('instrument_snapshot as s')
                ->leftJoinSub($cpSub, 'cp', function ($join) {
                    $join->whereRaw('cp.symbol_key = UPPER(TRIM(s.symbol))');
                })
                ->whereRaw('UPPER(TRIM(s.symbol)) = ?', [$sym])
                ->first([
                    's.instrument_id',
                    's.symbol',
                    's.price',
                    's.volume',
                    's.liquidity',
                    's.change_pct',
                    DB::raw('COALESCE(cp.company_name, s.symbol) as company_name'),
                    'cp.company_logo',
                ]);
        } else {
            $row = DB::table('instrument_snapshot as s')
                ->whereRaw('UPPER(TRIM(s.symbol)) = ?', [$sym])
                ->first([
                    's.instrument_id',
                    's.symbol',
                    's.price',
                    's.volume',
                    's.liquidity',
                    's.change_pct',
                    DB::raw('s.symbol as company_name'),
                    DB::raw('NULL as company_logo'),
                ]);
        }

        return $row ?: null;
    }

    /**
     * @param  Collection<int, object>  $rows
     * @return list<array<string, mixed>>
     */
    protected function buildBeginnerRankingRowsFromSnapshotRows(Collection $rows): array
    {
        if ($rows->isEmpty()) {
            return [];
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

        $confidenceBySymbol = $this->analysisConfidenceBySymbols($symbols->all());

        $bySymbol = [];
        foreach ($rows as $r) {
            $sym = strtoupper(trim((string) $r->symbol));
            $people = (int) ($watchCounts[$sym] ?? 0);
            $iid = (string) $r->instrument_id;
            $vsPrevAbs = $vsPrevAbsByInstrument[$iid] ?? null;
            $chg = abs((float) $r->change_pct);
            $candleMove = ($vsPrevAbs !== null && $vsPrevAbs > 0) ? $vsPrevAbs : $chg;

            $logo = isset($r->company_logo) && $r->company_logo !== null && trim((string) $r->company_logo) !== ''
                ? trim((string) $r->company_logo)
                : null;

            $bySymbol[$sym] = [
                'instrument_id' => $iid,
                'company_name' => (string) $r->company_name,
                'logo_url' => $logo,
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
            $conf = $confidenceBySymbol[$sym] ?? null;
            $signalSpoke = $this->signalSpokeFromConfidenceOrWatchers($conf, $d['people_watching']);
            $watchRep = $this->reputationScoreFromWatchers($d['people_watching']);

            $scores = [
                // Radar “Signal” spoke: cached python_engine analysis confidence (0–100 → 1–5) when present, else watchlist tiers.
                'reputation' => $signalSpoke,
                'price_period' => (int) ($priceScores[$sym] ?? 3),
                'candle_change' => (int) ($candleScores[$sym] ?? 3),
                'volume' => (int) ($volScores[$sym] ?? 3),
                'liquidity' => (int) ($liqScores[$sym] ?? 3),
                'people_care' => (int) ($peopleScores[$sym] ?? 3),
                'watchlist_reputation' => $watchRep,
                'analysis_confidence' => $conf,
            ];

            $strongCount = $this->beginnerStrongCountFive($scores);

            $radar = [
                ['subject' => 'Signal', 'value' => $scores['reputation']],
                ['subject' => 'Price', 'value' => $scores['price_period']],
                ['subject' => 'Change', 'value' => $scores['candle_change']],
                ['subject' => 'Volume', 'value' => $scores['volume']],
                ['subject' => 'Liquidity', 'value' => $scores['liquidity']],
                ['subject' => 'Watchers', 'value' => $scores['people_care']],
            ];

            $chg = round((float) $d['change_pct'], 2);

            $ranked[] = [
                'symbol' => $sym,
                'company_name' => $d['company_name'],
                'logo_url' => $d['logo_url'],
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

        return $ranked;
    }

    /**
     * Per-symbol beginner radar (1–5 spokes) using the same quintile pool as the ranking board.
     */
    public function beginnerRadarForSymbol(string $symbol, int $poolLimit = 100): ?array
    {
        $sym = strtoupper(trim($symbol));
        if ($sym === '') {
            return null;
        }
        $poolLimit = max(20, min(500, $poolLimit));

        $rows = $this->queryTopSnapshotRowsForBeginnerRadar($poolLimit);
        $hasTarget = $rows->contains(fn ($r) => strtoupper(trim((string) $r->symbol)) === $sym);
        if (! $hasTarget) {
            $one = $this->querySingleSnapshotRowForBeginnerRadar($sym);
            if ($one === null) {
                return null;
            }
            $rows = $rows->values()->push($one);
        }

        $ranked = $this->buildBeginnerRankingRowsFromSnapshotRows($rows);
        foreach ($ranked as $row) {
            if ($row['symbol'] === $sym) {
                $chg = (float) $row['change_pct_snapshot'];

                return [
                    'symbol' => $sym,
                    'axes' => $this->beginnerRadarAxisLabels(),
                    'radar' => $row['radar'],
                    'scores' => $row['scores'],
                    'strong_count' => $row['strong_count'],
                    'change_pct_snapshot' => $chg,
                    'fear_greed' => $this->beginnerFearGreedFromChangePct($chg),
                    'pool_limit' => $poolLimit,
                ];
            }
        }

        return null;
    }

    /**
     * F = round(clamp(50 + 3.25 × snapshot %, 0, 100)) with homepage bucket labels.
     *
     * @return array{value: int, label: string}
     */
    protected function beginnerFearGreedFromChangePct(float $changePct): array
    {
        $v = (int) round(max(0, min(100, 50 + $changePct * 3.25)));
        $label = match (true) {
            $v <= 24 => 'Extreme Fear',
            $v <= 44 => 'Fear',
            $v <= 55 => 'Neutral',
            $v <= 74 => 'Greed',
            default => 'Extreme Greed',
        };

        return ['value' => $v, 'label' => $label];
    }

    protected function beginnerRankingBoardUncached(int $limit): array
    {
        $rows = $this->queryTopSnapshotRowsForBeginnerRadar($limit);

        if ($rows->isEmpty()) {
            return [
                'axes' => $this->beginnerRadarAxisLabels(),
                'rows' => [],
                'legend' => [
                    'strong_rule' => 'Str counts scores ≥ 4 on five radar spokes: Signal, Change, Volume, Liquidity, Watchers (Price is not counted). Higher rank = more strong traits.',
                    'tie_break' => 'The board pool is the top symbols by snapshot volume (cached up to 3 hours). If two rows tie on strong traits, we order by liquidity, then volume, then watchlist saves.',
                    'buy_sell' => 'Green “Buy” / red “Sell” uses the same daily snapshot % change as our dashboard (up vs down). It is not financial advice.',
                ],
            ];
        }

        $ranked = $this->buildBeginnerRankingRowsFromSnapshotRows($rows);

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
                'strong_rule' => 'Str counts scores ≥ 4 on five radar spokes: Signal, Change, Volume, Liquidity, Watchers (Price is not counted). Higher rank = more strong traits.',
                'tie_break' => 'The board pool is the top symbols by snapshot volume (cached up to 3 hours). If two rows tie on strong traits, we order by liquidity, then volume, then watchlist saves.',
                'buy_sell' => 'Green “Buy” / red “Sell” uses the same daily snapshot % change as our dashboard (up vs down). It is not financial advice.',
            ],
        ];
    }

    /**
     * Strong-trait count for the five radar chart spokes (matches frontend polygon; Price spoke excluded).
     *
     * @param  array<string, mixed>  $scores  Keys: reputation, price_period, candle_change, volume, liquidity, people_care, …
     */
    protected function beginnerStrongCountFive(array $scores): int
    {
        $keys = ['reputation', 'candle_change', 'volume', 'liquidity', 'people_care'];
        $n = 0;
        foreach ($keys as $k) {
            $v = $scores[$k] ?? null;
            if (is_numeric($v) && (int) $v >= self::BEGINNER_STRONG_TRAIT_MIN_SCORE) {
                $n++;
            }
        }

        return $n;
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
                    SELECT p.instrument_id,
                        CAST(d.close AS DECIMAL(20,10)) AS c_last,
                        ROW_NUMBER() OVER (PARTITION BY p.instrument_id ORDER BY d.timestamps DESC) AS rn
                    FROM instrument_data AS d
                    INNER JOIN instrument_periods AS p ON p.id = d.instrument_period_id AND p.period = 'daily'
                    WHERE p.instrument_id IN ({$placeholders})
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
                        SELECT p.instrument_id,
                            CAST(d.close AS REAL) AS c_last,
                            ROW_NUMBER() OVER (PARTITION BY p.instrument_id ORDER BY d.timestamps DESC) AS rn
                        FROM instrument_data AS d
                        INNER JOIN instrument_periods AS p ON p.id = d.instrument_period_id AND p.period = 'daily'
                        WHERE p.instrument_id IN ({$placeholders})
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
     * Radar “Signal” spoke: use python_engine Redis analysis confidence (0–100) when cached, else watchlist tiers.
     */
    protected function signalSpokeFromConfidenceOrWatchers(?float $confidence0to100, int $peopleWatching): int
    {
        if ($confidence0to100 !== null && is_finite($confidence0to100)) {
            return $this->signalQuintileFromPercent($confidence0to100);
        }

        return $this->reputationScoreFromWatchers($peopleWatching);
    }

    /**
     * Map 0–100 confidence to radar 1–5 (under 20 → 1 … 80+ → 5).
     */
    protected function signalQuintileFromPercent(float $p): int
    {
        $p = max(0.0, min(100.0, $p));

        return match (true) {
            $p >= 80.0 => 5,
            $p >= 60.0 => 4,
            $p >= 40.0 => 3,
            $p >= 20.0 => 2,
            default => 1,
        };
    }

    /**
     * Batch-read `summary:analysis:{SYMBOL}` JSON from Redis (python_engine / auto_analyze cache).
     *
     * @param  list<string>  $symbolsUpper
     * @return array<string, float> symbol => confidence 0..100
     */
    protected function analysisConfidenceBySymbols(array $symbolsUpper): array
    {
        $symbolsUpper = array_values(array_unique(array_filter(array_map(
            fn ($s) => strtoupper(trim((string) $s)),
            $symbolsUpper
        ))));

        if ($symbolsUpper === []) {
            return [];
        }

        $pe = (string) env('PYTHON_ENGINE_ANALYSIS_KEY_PREFIX', 'summary');
        $keys = array_map(static fn (string $s): string => "{$pe}:analysis:{$s}", $symbolsUpper);

        try {
            $raws = Redis::connection('python_engine')->mget($keys);
        } catch (\Throwable) {
            return [];
        }

        if (! is_array($raws)) {
            return [];
        }

        $out = [];
        foreach ($symbolsUpper as $i => $s) {
            $raw = $raws[$i] ?? null;
            $c = $this->parseAnalysisConfidenceFromRedisPayload(is_string($raw) ? $raw : null);
            if ($c !== null) {
                $out[$s] = $c;
            }
        }

        return $out;
    }

    protected function parseAnalysisConfidenceFromRedisPayload(?string $raw): ?float
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        $d = json_decode($raw, true);
        if (! is_array($d)) {
            return null;
        }

        if (isset($d['confidence']) && is_numeric($d['confidence'])) {
            return (float) $d['confidence'];
        }

        if (isset($d['confidence']) && is_array($d['confidence']) && isset($d['confidence']['score']) && is_numeric($d['confidence']['score'])) {
            return (float) $d['confidence']['score'];
        }

        return null;
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
        return ['Signal', 'Price', 'Change', 'Volume', 'Liquidity', 'Watchers'];
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