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

    'verbs' => [
        'give', 'show', 'get', 'tell', 'list', 'provide', 'apply'
    ],
    'fillers' => [
        'me', 'please', 'today', 'now', 'full', 'text', 'include'
    ],
    'negations' => [
        'no', 'not', 'without'
    ],
    'domain_nouns' => [
        'stock','stocks','price','prices','analysis','text'
    ],
    'stopwords' => [
        'the','of','and','or','to','for','in','on','at','with'
    ],
];
