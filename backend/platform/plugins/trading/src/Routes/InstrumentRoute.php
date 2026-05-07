<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\InstrumentController;
use Platform\Plugins\Trading\Src\Http\Controllers\InstrumentPeriodsController;
use Platform\Plugins\Trading\Src\Http\Controllers\InstrumentDataController;

Route::prefix('/instruments')->group(function () {
    Route::get('/data', [InstrumentDataController::class, 'index']);

    // Keep specific data paths before `/data/{symbol}`.
    Route::post('/data/batch-daily-closes', [InstrumentDataController::class, 'batchDailyCloses']);
    Route::get('/data/period/{periodId}', [InstrumentDataController::class, 'showByPeriod']);

    // Canonical history endpoint.
    Route::get('/data-history/{symbol}', [InstrumentDataController::class, 'getHistory']);
    // Backward-compatible alias for existing clients.
    Route::get('/history-data/{symbol}', [InstrumentDataController::class, 'getHistory']);
    Route::get('/data/{symbol}', [InstrumentDataController::class, 'get']);

    // Must be before `/{symbol}` so "periods" is not captured as a ticker.
    Route::get('/periods/{id}', [InstrumentPeriodsController::class, 'show']);

    Route::get('/', [InstrumentController::class, 'index']);
    Route::get('/{symbol}', [InstrumentController::class, 'show']);
    Route::delete('/{id}', [InstrumentController::class, 'destroy']);
});