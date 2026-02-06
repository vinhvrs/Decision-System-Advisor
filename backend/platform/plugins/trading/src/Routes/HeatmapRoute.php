<?php

namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\HeatmapController;

Route::prefix('heatmap')->group(function () {
    Route::get('/daily', [HeatmapController::class, 'daily']);
});
