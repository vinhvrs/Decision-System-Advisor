<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\StockController;

Route::prefix('/trading')->group(function () {
    Route::get('/stocks/calculate/{instrumentId}', [StockController::class, 'calculateAttribute']);
    Route::post('/stocks/import/{instrumentId}', [StockController::class, 'importAttributes']);

    Route::get('/stocks', [StockController::class, 'index']);
    Route::get('/stocks/{id}', [StockController::class, 'show']);
    Route::post('/stocks', [StockController::class, 'store']);
    Route::put('/stocks/{id}', [StockController::class, 'update']);
    Route::delete('/stocks/{id}', [StockController::class, 'destroy']);
});