<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Response prefixes / phrasing
    |--------------------------------------------------------------------------
    */

    'prefix' => [
        'default' => [
            'Here’s what I can share based on the available information.',
            'Here is a brief overview.',
            'This is what I found for you.',
        ],

        'concise' => [
            'Here is a quick summary.',
            'In short:',
        ],

        'analytical' => [
            'Here is a technical breakdown.',
            'Let’s look at the analysis.',
        ],
        'spoken_professional' => [
            'Based on the current technical setup,',
            'From a technical analysis perspective,',
            'Looking at the latest indicators,',
        ],
        'spoken_casual' => [
            'Right now,',
            'At the moment,',
            'From what the charts show,',
        ],
    ],

    'news_request' => [
        "Here’s what I found for you.",
        "This is the latest information.",
        "Here is a brief overview.",
    ],

    'analysis_request' => [
        "Here is a detailed analysis.",
        "Let’s take a closer look.",
    ],

    'price_request' => [
        "Here is the current price information.",
    ],

    'unknown' => [
        "Here’s what I can share based on the available information.",
    ],

    /*
    |--------------------------------------------------------------------------
    | Follow-up questions
    |--------------------------------------------------------------------------
    */

    'follow_up' => [
        'Do you want a brief answer or a more detailed explanation?',
        'Let me know if you want a deeper breakdown.',
        'Would you like to explore this further?',
        'Traders may consider monitoring price action closely.',
        'Patience could be warranted before committing capital.',
        'Risk management remains essential in this environment.',
    ],

    /*
    |--------------------------------------------------------------------------
    | Recommendation core (BUY / HOLD / SELL)
    |--------------------------------------------------------------------------
    */
    'recommendation' => [
        'BUY' => [
            'a buying opportunity is emerging',
            'conditions favor a potential upside move',
            'the setup supports a bullish entry',
        ],
        'HOLD' => [
            'a wait-and-see approach is advisable',
            'conditions remain inconclusive',
            'the risk-reward profile is currently balanced',
        ],
        'SELL' => [
            'downside risks are increasing',
            'selling pressure appears to be dominant',
            'the setup suggests elevated downside risk',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Trend descriptors
    |--------------------------------------------------------------------------
    */
    'trend' => [
        'bullish' => [
            'the broader trend remains bullish',
            'price action continues to favor the upside',
            'the prevailing trend is still positive',
        ],
        'bearish' => [
            'the broader trend remains bearish',
            'price action continues to lean lower',
            'the prevailing trend is negative',
        ],
        'sideways' => [
            'the market is currently moving sideways',
            'price action lacks a clear directional bias',
            'the trend remains range-bound',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Momentum descriptors
    |--------------------------------------------------------------------------
    */
    'momentum' => [
        'strong' => [
            'momentum is accelerating',
            'buying pressure is strengthening',
        ],
        'moderate' => [
            'momentum remains moderate',
            'directional strength is limited',
        ],
        'weak' => [
            'momentum appears weak',
            'directional conviction is lacking',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Volatility descriptors
    |--------------------------------------------------------------------------
    */
    'volatility' => [
        'high' => [
            'volatility is elevated',
            'price swings may remain aggressive',
        ],
        'medium' => [
            'volatility remains at moderate levels',
        ],
        'low' => [
            'volatility is relatively subdued',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Confidence tone
    |--------------------------------------------------------------------------
    */
    // trong phrases.php
    'confidence_tone' => [
        'high' => [
            'with strong conviction',
            'with a high degree of confidence',
        ],
        'medium' => [
            'with moderate confidence',
        ],
        'low' => [
            'with limited conviction',
            'with a higher degree of uncertainty',
        ],
    ],

];