<?php
namespace Platform\Plugins\Trading\Src\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
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