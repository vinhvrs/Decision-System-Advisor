<?php

use App\Http\Controllers\DailyMarketAnalyticsController;
use Illuminate\Support\Facades\Route;
require __DIR__.'/load_plugins.php';

Route::get('market/daily-analytics', DailyMarketAnalyticsController::class)->middleware('throttle:60,1');
