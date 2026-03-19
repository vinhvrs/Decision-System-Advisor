<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\StatisticsService;

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
        $data = $this->statsService->getMostWatchedWithCompanies(50);
        return response()->json(['data' => $data]);
    }
}
