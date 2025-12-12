<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\InstrumentPeriodsController;

// Route::prefix('/instruments')->group(function () {
//     Route::get('/periods', [InstrumentPeriodsController::class, 'index']);
//     Route::get('/periods/{id}', [InstrumentPeriodsController::class, 'show']);
//     Route::post('/periods', [InstrumentPeriodsController::class, 'store']);
//     Route::put('/periods/{id}', [InstrumentPeriodsController::class, 'update']);
//     Route::delete('/periods/{id}', [InstrumentPeriodsController::class, 'destroy']);
//     Route::post('/periods/generate', [InstrumentPeriodsController::class, 'generate']);
// });