<?php

return [
    'response_strategy' => [

        'news_request' => [
            'mode' => 'informative',
            'require_data' => true,
            'allow_llm' => false,
        ],

        'analysis_request' => [
            'mode' => 'analytical',
            'require_data' => true,
            'allow_llm' => true,
        ],

        'price_request' => [
            'mode' => 'direct',
            'require_data' => true,
            'allow_llm' => false,
        ],

        'unknown' => [
            'mode' => 'fallback',
            'require_data' => false,
            'allow_llm' => true,
        ],
    ],
    
    'response_style' => [
        'default_profile' => 'spoken_professional',
        'profiles' => [
            'spoken_casual' => [
                'use_contractions' => true,
                'max_sentences' => 8,
                'structure' => 'short', // short|standard|formal
            ],
            'spoken_professional' => [
                'use_contractions' => true,
                'max_sentences' => 10,
                'structure' => 'standard',
            ],
            'written_standard' => [
                'use_contractions' => false,
                'max_sentences' => 12,
                'structure' => 'standard',
            ],
            'written_formal' => [
                'use_contractions' => false,
                'max_sentences' => 16,
                'structure' => 'formal',
            ],
        ],
    ],
];