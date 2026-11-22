<?php

use App\Http\Controllers\DailyMarketAnalyticsController;
use Illuminate\Support\Facades\Route;
require __DIR__.'/load_plugins.php';

Route::get('market/daily-analytics', DailyMarketAnalyticsController::class)->middleware('throttle:60,1');

Route::get('market/daily-history/{symbol}', \App\Http\Controllers\DailyMarketHistoryController::class)
    ->where('symbol', '[A-Za-z0-9.=_^\-]{1,16}')->middleware('throttle:60,1');
