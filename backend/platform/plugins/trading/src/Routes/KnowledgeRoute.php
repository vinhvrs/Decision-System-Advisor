<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\KnowledgeController;
use Platform\Plugins\Trading\Src\Http\Controllers\CollectData\GetNewsData;

Route::prefix('/news')->group(function () {
    Route::get('/fetch', [GetNewsData::class, 'fetchNewsData']);
    Route::get('/search', [GetNewsData::class, 'fetchNewsByKeyword']);
    Route::get('/get-by-slug/{slug}', [GetNewsData::class, 'getNewsBySlug']);


    Route::get('/knowledges', [KnowledgeController::class, 'index']);
    Route::get('/knowledges/{id}', [KnowledgeController::class, 'show']);
    Route::post('/knowledges', [KnowledgeController::class, 'store']);
    Route::put('/knowledges/{id}', [KnowledgeController::class, 'update']);
    Route::delete('/knowledges/{id}', [KnowledgeController::class, 'destroy']);
});
