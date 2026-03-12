<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\CompanyController;

Route::prefix('companies')->group(function () {
    Route::get('/{symbol}/similar', [CompanyController::class, 'getSimilarCompanies']);
    Route::get('/{symbol}', [CompanyController::class, 'getProfileBySymbol']);
});