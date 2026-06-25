<?php

namespace Database\Seeders;

use App\Models\Indicator;
use App\Models\IndicatorParameter;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class IndicatorCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = [
            [
                'slug' => 'global',
                'name' => 'Global settings',
                'description' => 'Default candle period for indicator API routes.',
                'params' => [
                    ['key' => 'default_period', 'value' => 'daily', 'type' => 'string', 'label' => 'Default period', 'order' => 0],
                ],
            ],
            [
                'slug' => 'sma',
                'name' => 'Simple Moving Average',
                'description' => 'SMA lookback length.',
                'params' => [
                    ['key' => 'period', 'value' => '14', 'type' => 'number', 'label' => 'SMA period', 'order' => 0],
                ],
            ],
            [
                'slug' => 'ema',
                'name' => 'Exponential Moving Average',
                'description' => 'EMA lookback for Laravel indicator endpoints.',
                'params' => [
                    ['key' => 'period', 'value' => '14', 'type' => 'number', 'label' => 'EMA period', 'order' => 0],
                ],
            ],
            [
                'slug' => 'ema_trend',
                'name' => 'EMA trend pair (Python engine)',
                'description' => 'Fast/slow EMA used for golden/death cross in the Python analysis engine.',
                'params' => [
                    ['key' => 'fast_period', 'value' => '20', 'type' => 'number', 'label' => 'Fast EMA', 'order' => 0],
                    ['key' => 'slow_period', 'value' => '100', 'type' => 'number', 'label' => 'Slow EMA', 'order' => 1],
                ],
            ],
            [
                'slug' => 'rsi',
                'name' => 'Relative Strength Index',
                'description' => 'RSI lookback and overbought/oversold zones use standard 70/30 in code.',
                'params' => [
                    ['key' => 'period', 'value' => '14', 'type' => 'number', 'label' => 'RSI period', 'order' => 0],
                ],
            ],
            [
                'slug' => 'macd',
                'name' => 'MACD',
                'description' => 'MACD fast, slow, and signal periods.',
                'params' => [
                    ['key' => 'fast_period', 'value' => '12', 'type' => 'number', 'label' => 'Fast period', 'order' => 0],
                    ['key' => 'slow_period', 'value' => '26', 'type' => 'number', 'label' => 'Slow period', 'order' => 1],
                    ['key' => 'signal_period', 'value' => '9', 'type' => 'number', 'label' => 'Signal period', 'order' => 2],
                ],
            ],
            [
                'slug' => 'stochastic',
                'name' => 'Stochastic oscillator',
                'description' => '%K, %D, and smoothing for stochastic.',
                'params' => [
                    ['key' => 'k_period', 'value' => '14', 'type' => 'number', 'label' => '%K period', 'order' => 0],
                    ['key' => 'd_period', 'value' => '3', 'type' => 'number', 'label' => '%D period', 'order' => 1],
                    ['key' => 'smooth_k', 'value' => '3', 'type' => 'number', 'label' => 'Smooth %K', 'order' => 2],
                ],
            ],
            [
                'slug' => 'bollinger',
                'name' => 'Bollinger Bands',
                'description' => 'Band period and standard-deviation multiplier.',
                'params' => [
                    ['key' => 'period', 'value' => '20', 'type' => 'number', 'label' => 'Period', 'order' => 0],
                    ['key' => 'std_dev_multiplier', 'value' => '2.0', 'type' => 'number', 'label' => 'Std dev multiplier', 'order' => 1],
                ],
            ],
        ];

        foreach ($catalog as $item) {
            $indicator = Indicator::query()->firstOrCreate(
                ['slug' => $item['slug']],
                [
                    'id' => (string) Str::uuid(),
                    'name' => $item['name'],
                    'description' => $item['description'],
                ]
            );

            foreach ($item['params'] as $param) {
                IndicatorParameter::query()->updateOrCreate(
                    [
                        'indicator_id' => $indicator->id,
                        'param_key' => $param['key'],
                    ],
                    [
                        'param_value' => $param['value'],
                        'value_type' => $param['type'],
                        'label' => $param['label'],
                        'description' => null,
                        'sort_order' => $param['order'],
                        'is_active' => true,
                    ]
                );
            }
        }
    }
}
