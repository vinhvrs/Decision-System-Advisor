<?php

use App\Http\Controllers\PublicContactController;
use App\Http\Controllers\PublicSiteMailController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:60,1')->get('contact/mail-display', [PublicSiteMailController::class, 'contactDisplay']);

Route::middleware('throttle:8,1')->group(function () {
    Route::post('contact', [PublicContactController::class, 'store']);
});
