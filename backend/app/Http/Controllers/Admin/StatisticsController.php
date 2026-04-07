<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\StatisticsService;
use Illuminate\Support\Facades\Cache;

class StatisticsController extends Controller
{
    public function __construct(
        protected StatisticsService $statsService
    ) {
    }

    /**
     * Most watched symbols/companies based on watchlist of ALL users.
     */
    public function mostWatched()
    {
        $ttl = (int) config('performance.stats_most_watched_ttl', 120);
        $data = Cache::remember('admin.stats.most_watched.v1', max(1, $ttl), function () {
            return $this->statsService->getMostWatchedWithCompanies(50);
        });

        return response()->json(['data' => $data]);
    }
}
