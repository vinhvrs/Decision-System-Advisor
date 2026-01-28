<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Intent definitions
    |--------------------------------------------------------------------------
    | intent_name => [keywords...]
    */

    'news_request' => [
        'news',
        'headline',
        'update',
    ],

    'price_request' => [
        'price',
        'value',
        'quote',
    ],

    'indicator_request' => [
        'indicator',
        'macd',
        'rsi',
        'ohlcv',
    ],

    'buy_decision' => [
        'buy',
        'entry',
        'long',
    ],

    'sell_decision' => [
        'sell',
        'exit',
        'short',
    ],
];
