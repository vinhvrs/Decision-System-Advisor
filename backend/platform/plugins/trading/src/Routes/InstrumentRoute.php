<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\InstrumentController;

Route::prefix('/trading')->group(function () {
    Route::get('/instruments', [InstrumentController::class, 'index']);
    Route::get('/instruments/{id}', [InstrumentController::class, 'show']);
    Route::post('/instruments', [InstrumentController::class, 'store']);
    Route::put('/instruments/{id}', [InstrumentController::class, 'update']);
    Route::delete('/instruments/{id}', [InstrumentController::class, 'destroy']);
    // Route::get('/finnhub/stocks', [InstrumentController::class, 'fetchListStock']);
});