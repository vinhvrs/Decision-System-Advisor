<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\NewsController;
use Platform\Plugins\Trading\Src\Http\Controllers\CollectData\GetNewsData;

Route::prefix('news')->group(function () {
    Route::get('symbol/{symbol}', [NewsController::class, 'getBySymbol']);
    Route::get('', [NewsController::class, 'index']);
    Route::get('{id}', [NewsController::class, 'show']);
    Route::delete('{id}', [NewsController::class, 'destroy']);
});
