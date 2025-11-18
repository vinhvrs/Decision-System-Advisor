<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\InstrumentPeriodsController;

Route::prefix('/trading')->group(function () {
    Route::get('/instrument-periods', [InstrumentPeriodsController::class, 'index']);
    Route::get('/instrument-periods/{id}', [InstrumentPeriodsController::class, 'show']);
    Route::post('/instrument-periods', [InstrumentPeriodsController::class, 'store']);
    Route::put('/instrument-periods/{id}', [InstrumentPeriodsController::class, 'update']);
    Route::delete('/instrument-periods/{id}', [InstrumentPeriodsController::class, 'destroy']);
    // Route::post('/instrument-periods/generate', [InstrumentPeriodsController::class, 'generate']);
});