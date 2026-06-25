<?php

use App\Http\Controllers\IndicatorConfigController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:120,1')->get('indicator-config', [IndicatorConfigController::class, 'show']);
