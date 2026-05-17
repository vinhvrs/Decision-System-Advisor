<?php

use App\Http\Controllers\FundamentalsController;
use Illuminate\Support\Facades\Route;

Route::prefix('fundamentals')->group(function () {
    Route::get('screener', [FundamentalsController::class, 'screener']);
    Route::get('{symbol}', [FundamentalsController::class, 'show'])
        ->where('symbol', '[A-Za-z]{1,12}');
    Route::get('{symbol}/annual', [FundamentalsController::class, 'annual'])
        ->where('symbol', '[A-Za-z]{1,12}');
    Route::get('{symbol}/quarterly', [FundamentalsController::class, 'quarterly'])
        ->where('symbol', '[A-Za-z]{1,12}');
    Route::get('{symbol}/score', [FundamentalsController::class, 'score'])
        ->where('symbol', '[A-Za-z]{1,12}');
});

Route::get('filings/{symbol}', [FundamentalsController::class, 'filings'])
    ->where('symbol', '[A-Za-z]{1,12}');
