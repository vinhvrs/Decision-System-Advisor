<?php
namespace Platform\Plugins\Trading\Src\Routes;

use Illuminate\Support\Facades\Route;
use Platform\Plugins\Trading\Src\Http\Controllers\AnalysistController;

Route::prefix('/analysist/indicators')->group(function () {
    Route::get('/{symbol}/sma', [AnalysistController::class, 'SMA']);
    Route::get('/{symbol}/ema', [AnalysistController::class, 'EMA']);
    Route::get('/{symbol}/rsi', [AnalysistController::class, 'RSI']);
    Route::get('/{symbol}/macd', [AnalysistController::class, 'MACD']);
    Route::get('/{symbol}/bollinger-bands', [AnalysistController::class, 'BollingerBands']);
    Route::get('/{symbol}/stochastic-oscillator', [AnalysistController::class, 'StochasticOscillator']);
    Route::get('/{symbol}/summary', [AnalysistController::class, 'IndicatorSummary']);
    Route::post('/aggregator', [AnalysistController::class, 'Aggregator']);
});