<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\UserManagementController;
use App\Http\Controllers\Admin\CompanyManagementController;
use App\Http\Controllers\Admin\LogViewerController;
use App\Http\Controllers\Admin\NewsManagementController;
use App\Http\Controllers\Admin\StatisticsController;
use App\Http\Controllers\Admin\ContactInboxController;
use App\Http\Controllers\Admin\EmailController;
use App\Http\Controllers\Admin\IndicatorParameterController;
use App\Http\Controllers\Admin\SiteMailSettingController;
use Platform\Plugins\Trading\Src\Http\Controllers\AuthController;

Route::prefix('admin')->group(function () {
    Route::middleware('throttle:admin-login')->post('/auth/login', [AuthController::class, 'login']);
});

Route::prefix('admin')->middleware(['auth:sanctum', 'admin.staff', 'admin.activity'])->group(function () {
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

    Route::get('logs', [LogViewerController::class, 'show']);
    Route::get('logs/laravel-entries', [LogViewerController::class, 'laravelEntries']);
    Route::get('logs/activity', [LogViewerController::class, 'activity']);

    Route::middleware('throttle:60,1')->group(function () {
        Route::get('email/config', [EmailController::class, 'config']);
        Route::get('email/messages', [EmailController::class, 'messages']);
        Route::get('email/contact-unread-count', [ContactInboxController::class, 'unreadCount']);
        Route::get('email/contact-submissions', [ContactInboxController::class, 'index']);

        Route::get('indicators/catalog', [IndicatorParameterController::class, 'catalog']);
        Route::get('indicators/{indicatorId}/parameters', [IndicatorParameterController::class, 'index'])
            ->whereUuid('indicatorId');
        Route::get('site-mail-settings', [SiteMailSettingController::class, 'show']);
    });

    Route::middleware('throttle:30,1')->group(function () {
        Route::post('email/test', [EmailController::class, 'sendTest']);
        Route::post('email/send', [EmailController::class, 'send']);
        Route::post('email/inbound', [EmailController::class, 'recordInbound']);
        Route::post('email/contact-submissions/read-all', [ContactInboxController::class, 'markAllRead']);
        Route::post('email/contact-submissions/{id}/read', [ContactInboxController::class, 'markRead']);

        Route::post('indicators/{indicatorId}/parameters', [IndicatorParameterController::class, 'store'])
            ->whereUuid('indicatorId');
        Route::put('indicators/{indicatorId}/parameters/{parameterId}', [IndicatorParameterController::class, 'update'])
            ->whereUuid('indicatorId')
            ->whereUuid('parameterId');
        Route::delete('indicators/{indicatorId}/parameters/{parameterId}', [IndicatorParameterController::class, 'destroy'])
            ->whereUuid('indicatorId')
            ->whereUuid('parameterId');
        Route::put('site-mail-settings', [SiteMailSettingController::class, 'update']);
    });
});
