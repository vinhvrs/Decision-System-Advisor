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
     * Get most watched with company names (join company_profile).
     */
    public function getMostWatchedWithCompanies(int $limit = 20): Collection
    {
        $rows = DB::table('watchlist')
            ->select('watchlist.symbol', DB::raw('COUNT(*) as watch_count'), DB::raw('COUNT(DISTINCT watchlist.user_id) as user_count'))
            ->groupBy('watchlist.symbol')
            ->orderByDesc('watch_count')
            ->limit($limit)
            ->get();

        $symbols = $rows->pluck('symbol')->toArray();
        $companies = DB::table('company_profile')
            ->whereIn('symbol', $symbols)
            ->get()
            ->keyBy('symbol');

        return $rows->map(function ($row) use ($companies) {
            $company = $companies->get($row->symbol);
            $row->company_name = $company->company_name ?? null;
            return $row;
        });
    }
}
