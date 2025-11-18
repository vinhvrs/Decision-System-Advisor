<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\InstrumentDataController;
use Platform\Plugins\Trading\Src\Http\Controllers\FetchDataController;

Route::prefix('/trading')->group(function () {
    Route::get('/instrument-data', [InstrumentDataController::class, 'index']);
    Route::get('/instrument-data/period/{periodId}', [InstrumentDataController::class, 'showByPeriod']);
    Route::get('/instrument-data/{id}', [InstrumentDataController::class, 'show']);
    Route::post('/instrument-data', [InstrumentDataController::class, 'store']);
    Route::put('/instrument-data/{id}', [InstrumentDataController::class, 'update']);
    Route::delete('/instrument-data/{id}', [InstrumentDataController::class, 'destroy']);
    Route::post('/instrument-data/fetch/{periodId}', [FetchDataController::class, 'fetch']);
    Route::post('/instrument-data/import/{periodId}', [FetchDataController::class, 'importData']);
});