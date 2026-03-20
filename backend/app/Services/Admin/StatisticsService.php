<?php

namespace App\Services\Admin;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class StatisticsService
{
    /**
     * Get most watched symbols across ALL users (watchlist aggregation).
     */
    public function getMostWatchedSymbols(int $limit = 20): Collection
    {
        return DB::table('watchlist')
            ->select('symbol', DB::raw('COUNT(*) as watch_count'), DB::raw('COUNT(DISTINCT user_id) as user_count'))
            ->groupBy('symbol')
            ->orderByDesc('watch_count')
            ->limit($limit)
            ->get();
    }

    /**
     * Get most watched with company names (single round-trip via correlated subquery).
     */
    public function getMostWatchedWithCompanies(int $limit = 20): Collection
    {
        return DB::table('watchlist as w')
            ->select(
                'w.symbol',
                DB::raw('COUNT(*) as watch_count'),
                DB::raw('COUNT(DISTINCT w.user_id) as user_count'),
                DB::raw('(SELECT cp.company_name FROM company_profile cp WHERE cp.symbol = w.symbol LIMIT 1) as company_name')
            )
            ->groupBy('w.symbol')
            ->orderByDesc('watch_count')
            ->limit($limit)
            ->get();
    }
}
