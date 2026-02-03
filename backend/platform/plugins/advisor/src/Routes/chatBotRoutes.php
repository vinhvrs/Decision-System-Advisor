<?php

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Advisor\Src\Http\Controllers\ChatBotController;
use Platform\Plugins\Advisor\Src\Http\Controllers\ElasticEntityController;

Route::prefix('chatbot')->group(function () {
    Route::post('/chat', [ChatBotController::class, 'chat']);
    Route::post('/import', [ElasticEntityController::class, 'import']);
    Route::get('/resolve', [ElasticEntityController::class, 'resolve']);
    Route::get('/aggregator', [ChatBotController::class, 'aggregator']);
});
