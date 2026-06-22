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
use App\Http\Controllers\Admin\DataBackfillController;
use App\Http\Controllers\Admin\SiteMailSettingController;
use Platform\Plugins\Trading\Src\Http\Controllers\AuthController;

Route::prefix('admin')->group(function () {
    Route::middleware('throttle:admin-login')->post('/auth/login', [AuthController::class, 'login']);
});

Route::prefix('admin')
    ->middleware(['auth:sanctum', 'admin.staff', 'admin.activity'])
    ->name('admin.')
    ->group(function () {
    Route::get('users', [UserManagementController::class, 'index'])->name('users.index');
    Route::get('users/{id}', [UserManagementController::class, 'show'])->name('users.show');
    Route::put('users/{id}', [UserManagementController::class, 'update'])->name('users.update');
    Route::put('users/{id}/role', [UserManagementController::class, 'updateRole'])->name('users.update-role');

    Route::get('companies', [CompanyManagementController::class, 'index'])->name('companies.index');
    Route::get('companies/{symbol}', [CompanyManagementController::class, 'show'])->name('companies.show');
    Route::put('companies/{symbol}', [CompanyManagementController::class, 'update'])->name('companies.update');

    Route::get('news', [NewsManagementController::class, 'index'])->name('news.index');
    Route::get('news/{id}', [NewsManagementController::class, 'show'])->name('news.show');
    Route::delete('news/{id}', [NewsManagementController::class, 'destroy'])->name('news.destroy');

    Route::get('statistics/most-watched', [StatisticsController::class, 'mostWatched'])->name('statistics.most-watched');

    Route::get('data-backfill/catalog', [DataBackfillController::class, 'catalog'])->name('data-backfill.catalog');

    Route::get('logs', [LogViewerController::class, 'show'])->name('logs.show');
    Route::get('logs/laravel-entries', [LogViewerController::class, 'laravelEntries'])->name('logs.laravel-entries');
    Route::get('logs/activity', [LogViewerController::class, 'activity'])->name('logs.activity');

    Route::middleware('throttle:60,1')->group(function () {
        Route::get('email/config', [EmailController::class, 'config'])->name('email.config');
        Route::get('email/messages', [EmailController::class, 'messages'])->name('email.messages');
        Route::get('email/contact-unread-count', [ContactInboxController::class, 'unreadCount'])->name('email.contact-unread-count');
        Route::get('email/contact-submissions', [ContactInboxController::class, 'index'])->name('email.contact-submissions');

        Route::get('indicators/catalog', [IndicatorParameterController::class, 'catalog'])->name('indicators.catalog');
        Route::get('indicators/{indicatorId}/parameters', [IndicatorParameterController::class, 'index'])
            ->whereUuid('indicatorId')
            ->name('indicators.parameters.index');
        Route::get('site-mail-settings', [SiteMailSettingController::class, 'show'])->name('site-mail-settings.show');
    });

    Route::middleware('throttle:30,1')->group(function () {
        Route::post('data-backfill/run', [DataBackfillController::class, 'run'])->name('data-backfill.run');

        Route::post('email/test', [EmailController::class, 'sendTest'])->name('email.test');
        Route::post('email/send', [EmailController::class, 'send'])->name('email.send');
        Route::post('email/inbound', [EmailController::class, 'recordInbound'])->name('email.inbound');
        Route::post('email/contact-submissions/read-all', [ContactInboxController::class, 'markAllRead'])->name('email.contact-submissions.read-all');
        Route::post('email/contact-submissions/{id}/read', [ContactInboxController::class, 'markRead'])->name('email.contact-submissions.read');

        Route::post('indicators/{indicatorId}/parameters', [IndicatorParameterController::class, 'store'])
            ->whereUuid('indicatorId')
            ->name('indicators.parameters.store');
        Route::put('indicators/{indicatorId}/parameters/{parameterId}', [IndicatorParameterController::class, 'update'])
            ->whereUuid('indicatorId')
            ->whereUuid('parameterId')
            ->name('indicators.parameters.update');
        Route::delete('indicators/{indicatorId}/parameters/{parameterId}', [IndicatorParameterController::class, 'destroy'])
            ->whereUuid('indicatorId')
            ->whereUuid('parameterId')
            ->name('indicators.parameters.destroy');
        Route::put('site-mail-settings', [SiteMailSettingController::class, 'update'])->name('site-mail-settings.update');
    });
});
