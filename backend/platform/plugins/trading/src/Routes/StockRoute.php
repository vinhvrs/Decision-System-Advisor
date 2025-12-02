<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\StockController;

Route::prefix('/advices')->group(function () {
    Route::get('/stocks/calculate/{instrumentId}', [StockController::class, 'calculateAttribute']);
    Route::post('/stocks/import/{instrumentId}', [StockController::class, 'importAttributes']);

    Route::get('/stocks', [StockController::class, 'index']);
    Route::get('/stocks/name/{name}', [StockController::class, 'showByName']);
    Route::get('/stocks/symbol/{symbol}', [StockController::class, 'showBySymbol']);
    Route::get('/stocks/{id}', [StockController::class, 'show']);
    Route::post('/stocks', [StockController::class, 'store']);
    Route::put('/stocks/{id}', [StockController::class, 'update']);
    Route::delete('/stocks/{id}', [StockController::class, 'destroy']);
});