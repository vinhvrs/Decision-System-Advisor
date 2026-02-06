<?php

namespace Platform\Plugins\Trading\Src\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Platform\Plugins\Trading\Src\Models\Instruments;

class LiquidityService
{
    /**
     * Redis ZSET key
     * member = symbol
     * score  = liquidity
     */
    protected string $rankingKey = 'liquidity:ranking:daily';

    /**
     * Rebuild daily liquidity ranking (last 30 days)
     */
    public function rebuildDaily(): void
    {
        $redis = Redis::connection();

        // clear old data
        $redis->del($this->rankingKey);

        Instruments::query()
            ->select('id')
            ->chunk(200, function ($chunk) use ($redis) {

                $ids = $chunk->pluck('id')->toArray();

                $rows = DB::table('instrument_data as d')
                    ->join('instrument_periods as p', 'p.id', '=', 'd.instrument_period_id')
                    ->join('instruments as i', 'i.id', '=', 'p.instrument_id')
                    ->where('p.period', 'daily')
                    ->where('d.volume', '>', 0)
                    ->where('d.timestamps', '>=', now()->subDays(30))
                    ->whereIn('p.instrument_id', $ids)
                    ->groupBy('i.symbol')
                    ->selectRaw('i.symbol, SUM(d.close * d.volume) AS liquidity')
                    ->get();

                foreach ($rows as $row) {
                    if ($row->liquidity <= 0) {
                        continue;
                    }

                    $redis->zadd(
                        $this->rankingKey,
                        (float) $row->liquidity,
                        $row->symbol
                    );
                }
            });

        // TTL = 1 day
        $redis->expire($this->rankingKey, 86400);
    }

    /**
     * Get top N symbols by liquidity
     */
    public function topDaily(int $limit = 100): array
    {
        return Redis::connection()->zrevrange(
            $this->rankingKey,
            0,
            $limit - 1,
            ['withscores' => true]
        );
    }

    /**
     * Check if symbol is in top liquidity
     */
    public function isLiquidSymbol(string $symbol, int $top = 100): bool
    {
        $rank = Redis::connection()->zrevrank(
            $this->rankingKey,
            $symbol
        );

        return $rank !== null && $rank < $top;
    }
}
