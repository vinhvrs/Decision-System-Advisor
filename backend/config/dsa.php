<?php

/**
 * DSA table mode: DEV_MODE=dev → demo tables; DEV_MODE=production → production tables.
 *
 * @see tables.csv demo pairs in repo root
 */
return [

    'dev_mode' => env('DEV_MODE', 'dev'),

    'use_demo_tables' => ! in_array(
        strtolower(trim((string) env('DEV_MODE', 'dev'))),
        ['production', 'prod'],
        true
    ),

    'tables' => [
        'company_profile' => [
            'production' => 'company_profile',
            'demo' => 'company_profile_demo',
        ],
        'instrument_data' => [
            'production' => 'instrument_data',
            'demo' => 'instrument_data_demo',
        ],
        'instruments' => [
            'production' => 'instruments',
            'demo' => 'instrument_demo',
        ],
        'instrument_periods' => [
            'production' => 'instrument_periods',
            'demo' => 'instrument_period_demo',
        ],
        'instrument_snapshot' => [
            'production' => 'instrument_snapshot',
            'demo' => 'snapshot_demo',
        ],
    ],

];
