<?php

use Illuminate\Support\Facades\Route;

Route::group(['prefix' => 'dsa', 'as' => 'dsa.'], function () {
    Route::get('/signals', [Modules\DsaAdvisor\Http\Controllers\Public\SignalsPublicController::class, 'index'])
        ->name('signals.index');
});