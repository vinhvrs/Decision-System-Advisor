<?php

return [
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