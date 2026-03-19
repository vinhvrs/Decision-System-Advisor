<?php

namespace Platform\Plugins\Users\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Users\Src\Http\Controllers\WatchlistController;

Route::prefix('watchlist')->middleware('auth:sanctum')->group(function () {
    Route::get('', [WatchlistController::class, 'index']);
    Route::post('', [WatchlistController::class, 'store']);
    Route::delete('/{symbol}', [WatchlistController::class, 'destroy']);
});
