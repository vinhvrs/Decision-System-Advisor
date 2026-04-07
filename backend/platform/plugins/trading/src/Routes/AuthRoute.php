<?php

namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\AuthController;

Route::prefix('/auth')->group(function () {
    Route::middleware('throttle:5,1')->group(function () {
        Route::post('/register/request-otp', [AuthController::class, 'registerRequestOtp']);
        Route::post('/forgot-password', [AuthController::class, 'forgotPasswordRequest']);
    });

    Route::middleware('throttle:12,1')->group(function () {
        Route::post('/register/verify', [AuthController::class, 'registerVerify']);
        Route::post('/forgot-password/verify', [AuthController::class, 'forgotPasswordVerify']);
        Route::post('/password/reset-temp', [AuthController::class, 'resetPasswordFromTemp']);
    });

    Route::middleware('throttle:login')->post('/login', [AuthController::class, 'login']);
    Route::middleware('auth:sanctum')->post('/logout', [AuthController::class, 'logout']);
});
