<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Response strategy per intent
    |--------------------------------------------------------------------------
    */

    'news_request' => [
        'mode' => 'informative',
        'require_data' => true,
        'allow_llm' => false,
    ],

    'price_request' => [
        'mode' => 'direct',
        'require_data' => true,
        'allow_llm' => false,
    ],

    'indicator_request' => [
        'mode' => 'analytical',
        'require_data' => true,
        'allow_llm' => true,
    ],

    'buy_decision' => [
        'mode' => 'advisory',
        'require_data' => true,
        'allow_llm' => true,
    ],

    'sell_decision' => [
        'mode' => 'advisory',
        'require_data' => true,
        'allow_llm' => true,
    ],

    'unknown' => [
        'mode' => 'fallback',
        'require_data' => false,
        'allow_llm' => true,
    ],
];
