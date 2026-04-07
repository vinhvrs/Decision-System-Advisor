<?php

use App\Http\Controllers\ElasticController;
use Illuminate\Support\Facades\Route;

Route::prefix('elastic')->group(function () {
    Route::get('/health', [ElasticController::class, 'health']);
    Route::get('/search', [ElasticController::class, 'search']);
    Route::get('/demo/top-symbols', [ElasticController::class, 'demoTopSymbols']);

    Route::get('/companies', [ElasticController::class, 'searchCompanies']);
    Route::get('/companies/symbol/{symbol}', [ElasticController::class, 'companyBySymbol']);
    Route::post('/companies/reindex', [ElasticController::class, 'reindexCompanies']);

    Route::get('/knowledge-docs', [ElasticController::class, 'searchKnowledgeDocs']);
    Route::get('/knowledge-docs/symbol/{symbol}', [ElasticController::class, 'knowledgeDocsBySymbol']);
    Route::post('/knowledge-docs/reindex', [ElasticController::class, 'reindexKnowledgeDocs']);
});