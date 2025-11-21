<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\InstrumentController;
use Platform\Plugins\Trading\Src\Http\Controllers\InstrumentPeriodsController;
use Platform\Plugins\Trading\Src\Http\Controllers\InstrumentDataController;
use Platform\Plugins\Trading\Src\Http\Controllers\FetchDataController;

Route::prefix('/instruments')->group(function () {
    Route::get('/periods', [InstrumentPeriodsController::class, 'index']);
    Route::get('/periods/{id}', [InstrumentPeriodsController::class, 'show']);
    Route::post('/periods', [InstrumentPeriodsController::class, 'store']);
    Route::put('/periods/{id}', [InstrumentPeriodsController::class, 'update']);
    Route::delete('/periods/{id}', [InstrumentPeriodsController::class, 'destroy']);
    
    Route::get('/data', [InstrumentDataController::class, 'index']);
    Route::get('/data/period/{periodId}', [InstrumentDataController::class, 'showByPeriod']);
    Route::get('/data/{id}', [InstrumentDataController::class, 'show']);
    Route::post('/data', [InstrumentDataController::class, 'store']);
    Route::put('/data/{id}', [InstrumentDataController::class, 'update']);
    Route::delete('/data/{id}', [InstrumentDataController::class, 'destroy']);
    Route::post('/data/fetch/{periodId}', [FetchDataController::class, 'fetch']);
    Route::post('/data/import/{periodId}', [FetchDataController::class, 'importData']);
    
    Route::get('/', [InstrumentController::class, 'index']);
    Route::get('/{id}', [InstrumentController::class, 'show']);
    Route::post('/', [InstrumentController::class, 'store']);
    Route::put('/{id}', [InstrumentController::class, 'update']);
    Route::delete('/{id}', [InstrumentController::class, 'destroy']);
    // Route::get('/finnhub/stocks', [InstrumentController::class, 'fetchListStock']);
});  