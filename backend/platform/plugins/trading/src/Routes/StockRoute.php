<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\StockController;

Route::prefix('/stocks')->group(function () {
    Route::post('/advices/{symbol}', [StockController::class, 'expertAdvices']);

    Route::get('', [StockController::class, 'index']);
    Route::get('/name/{name}', [StockController::class, 'showByName']);
    Route::get('/symbol/{symbol}', [StockController::class, 'showBySymbol']);
    Route::get('/{id}', [StockController::class, 'show']);

    Route::post('', [StockController::class, 'store']);
    Route::put('/{id}', [StockController::class, 'update']);
    Route::delete('/{id}', [StockController::class, 'destroy']);
});