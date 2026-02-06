<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\LiquidityController;

Route::prefix('/liquidity')->group(function () {
    Route::get('/top', [LiquidityController::class, 'top']);
});