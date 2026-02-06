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
        'give', 'show', 'get', 'tell', 'list', 'provide', 'apply', 'share', 'fetch', 'read', 'look up', 'analyze', 'explain', 'predict', 'forecast', 'advise', 'recommend', 'bring'
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
        'the','of','and','or','to','for','in','on','at','with','by','is','are','was','were','be','been','a','an','that','this','these','those','as','from','but','if','then','so','such',
        'should','could','would','can','will','may','might','must',
        'i','you','he','she','it','we','they','my','your','his','her','its','our','their',
    ],
];
