<?php

namespace Platform\Plugins\Trading\Src\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class HeatmapService
{
    protected string $heatmapKey = 'heatmap:daily';

    /**
     * Build daily heatmap & cache to Redis
     */
    public function rebuildDaily(int $limit = 100): void
    {
        Redis::del($this->heatmapKey);

        // 1. Lấy top liquidity từ Redis (rất nhẹ)
        $liquidity = Redis::zrevrange(
            'liquidity:ranking:daily',
            0,
            $limit - 1,
            ['withscores' => true]
        );

        if (empty($liquidity)) {
            return;
        }

        $symbols = array_keys($liquidity);

        /**
         * 2. Query CHỈ latest daily candle cho từng symbol
         * Không get toàn bảng
         */
        DB::table('instrument_data as d')
            ->join('instrument_periods as p', 'p.id', '=', 'd.instrument_period_id')
            ->join('instruments as i', 'i.id', '=', 'p.instrument_id')
            ->where('p.period', 'daily')
            ->whereIn('i.symbol', $symbols)
            ->where('d.timestamps', '>=', now()->subDays(2)) // chỉ cần gần nhất
            ->select([
                'i.symbol',
                'd.open',
                'd.close',
            ])
            ->orderBy('d.timestamps', 'desc')
            ->chunk(200, function ($rows) use ($liquidity) {

                foreach ($rows as $row) {
                    if ($row->open <= 0) {
                        continue;
                    }

                    $change = (($row->close - $row->open) / $row->open) * 100;
                    $liq = (float) ($liquidity[$row->symbol] ?? 0);

                    $item = [
                        'symbol' => $row->symbol,
                        'liquidity' => $liq,
                        'change_pct' => round($change, 2),
                        'size' => $this->calcSize($liq),
                        'color' => $this->calcColor($change),
                    ];

                    Redis::hset(
                        $this->heatmapKey,
                        $row->symbol,
                        json_encode($item)
                    );
                }
            });

        Redis::expire($this->heatmapKey, 86400);
    }

    /**
     * Read heatmap from Redis (FAST)
     */
    public function daily(int $limit = 100): array
    {
        $data = Redis::hgetall($this->heatmapKey);

        if (empty($data)) {
            return [];
        }

        return collect($data)
            ->map(fn($row) => json_decode($row, true))
            ->sortByDesc('liquidity')
            ->take($limit)
            ->values()
            ->toArray();
    }

    /* -------------------------
     * Helpers
     * ------------------------- */

    protected function calcSize(float $liquidity): float
    {
        return round(log10(max($liquidity, 1)), 2);
    }

    protected function calcColor(float $change): string
    {
        return match (true) {
            $change >= 3 => '#27ae60',
            $change > 0 => '#9be7c4',
            $change <= -3 => '#c0392b',
            default => '#f5b7b1',
        };
    }
}
