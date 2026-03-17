<?php
namespace App\Routes;

use App\Http\Controllers\Api\ElasticController;
use Illuminate\Support\Facades\Route;

Route::prefix('elastic')->group(function () {
    Route::get('/companies', [ElasticController::class, 'searchCompanies']);
    Route::get('/companies/symbol/{symbol}', [ElasticController::class, 'companyBySymbol']);
    Route::post('/companies/reindex', [ElasticController::class, 'reindexCompanies']);

    Route::get('/knowledge-docs', [ElasticController::class, 'searchKnowledgeDocs']);
    Route::get('/knowledge-docs/symbol/{symbol}', [ElasticController::class, 'knowledgeDocsBySymbol']);
    Route::post('/knowledge-docs/reindex', [ElasticController::class, 'reindexKnowledgeDocs']);
});