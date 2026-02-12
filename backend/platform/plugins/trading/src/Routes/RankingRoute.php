<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\RankingController;

Route::prefix('/rankings')->group(function () {
    Route::get('/top-liquidity', [RankingController::class, 'topLiquidity']);
    Route::get('/top-gainers', [RankingController::class, 'topGainers']);
    Route::get('/top-losers', [RankingController::class, 'topLosers']);
});
