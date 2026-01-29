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

    'analysis_request' => [
        'analysis',
        'analyze',
        'price analysis',
        'stock analysis',
    ],

    'price_request' => [
        'price',
        'prices',
        'stock price',
        'stock prices',
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
