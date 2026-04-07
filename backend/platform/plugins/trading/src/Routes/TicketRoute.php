<?php

namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\TicketController;

Route::prefix('tickets')->middleware('auth:sanctum')->group(function () {
    Route::get('', [TicketController::class, 'index']);
    Route::get('/positions', [TicketController::class, 'positions']);
    Route::get('/user/{user_id}', [TicketController::class, 'indexOpenByUser'])->middleware('user.self');
    Route::get('/user/{user_id}/{symbol}', [TicketController::class, 'indexByUserAndSymbol'])->middleware('user.self');
    Route::get('/{id}', [TicketController::class, 'show'])->middleware('ticket.owner');
    Route::post('', [TicketController::class, 'store']);
    Route::put('/{id}', [TicketController::class, 'update'])->middleware('ticket.owner');
    Route::post('/close', [TicketController::class, 'closePosition']);
    Route::put('/close', [TicketController::class, 'closePosition']);
    Route::delete('/{id}', [TicketController::class, 'destroy'])->middleware('ticket.owner');
});
