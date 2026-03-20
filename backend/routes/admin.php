<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\UserManagementController;
use App\Http\Controllers\Admin\CompanyManagementController;
use App\Http\Controllers\Admin\NewsManagementController;
use App\Http\Controllers\Admin\StatisticsController;
use Platform\Plugins\Trading\Src\Http\Controllers\AuthController;

Route::prefix('admin')->group(function () {
    Route::middleware('throttle:admin-login')->post('/auth/login', [AuthController::class, 'login']);
});

Route::prefix('admin')->middleware(['auth:sanctum', 'admin.staff'])->group(function () {
    Route::get('users', [UserManagementController::class, 'index']);
    Route::get('users/{id}', [UserManagementController::class, 'show']);
    Route::put('users/{id}', [UserManagementController::class, 'update']);
    Route::put('users/{id}/role', [UserManagementController::class, 'updateRole']);

    Route::get('companies', [CompanyManagementController::class, 'index']);
    Route::get('companies/{symbol}', [CompanyManagementController::class, 'show']);
    Route::put('companies/{symbol}', [CompanyManagementController::class, 'update']);

    Route::get('news', [NewsManagementController::class, 'index']);
    Route::get('news/{id}', [NewsManagementController::class, 'show']);
    Route::delete('news/{id}', [NewsManagementController::class, 'destroy']);

    Route::get('statistics/most-watched', [StatisticsController::class, 'mostWatched']);
});
