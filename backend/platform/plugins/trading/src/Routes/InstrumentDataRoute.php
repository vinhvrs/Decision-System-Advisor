<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\InstrumentDataController;
use Platform\Plugins\Trading\Src\Http\Controllers\CollectData\GetInstrumentData;

Route::prefix('/instruments')->group(function () {
    Route::get('/data', [InstrumentDataController::class, 'index']);
    Route::get('/data/period/{periodId}', [InstrumentDataController::class, 'showByPeriod']);
    Route::get('/data/{id}', [InstrumentDataController::class, 'show']);
    Route::post('/data', [InstrumentDataController::class, 'store']);
    Route::put('/data/{id}', [InstrumentDataController::class, 'update']);
    Route::delete('/data/{id}', [InstrumentDataController::class, 'destroy']);
    Route::post('/data/fetch/{periodId}', [GetInstrumentData::class, 'fetch']);
    Route::post('/data/import/{periodId}', [GetInstrumentData::class, 'importData']);
});