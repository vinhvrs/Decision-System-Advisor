<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\RankingController;

Route::prefix('rankings')->group(function () {
    Route::get('beginner-board', [RankingController::class, 'beginnerBoard']);
    Route::get('beginner/{symbol}', [RankingController::class, 'beginnerOverview'])
        ->where('symbol', '[A-Za-z0-9.\-]+');
    Route::get('top-liquidity', [RankingController::class, 'topLiquidity']);
    Route::get('bottom-liquidity', [RankingController::class, 'bottomLiquidity']);
    Route::get('top-gainers', [RankingController::class, 'topGainers']);
    Route::get('top-losers', [RankingController::class, 'topLosers']);
    Route::get('top-companies', [RankingController::class, 'topCompanies']);
    Route::get('top-market-cap', [RankingController::class, 'topMarketCap']);
    Route::get('heatmap-daily', [RankingController::class, 'heatmapDaily']);
});