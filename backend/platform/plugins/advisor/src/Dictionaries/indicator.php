<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Technical indicators
    |--------------------------------------------------------------------------
    */

    'ohlcv' => [
        'type' => 'price_series',
        'description' => 'Open High Low Close Volume',
    ],

    'macd' => [
        'type' => 'momentum',
        'description' => 'Moving Average Convergence Divergence',
    ],

    'rsi' => [
        'type' => 'momentum',
        'description' => 'Relative Strength Index',
    ],

];
