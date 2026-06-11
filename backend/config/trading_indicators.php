<?php

return [
    'default_period' => env('INDICATOR_DEFAULT_PERIOD', 'daily'),

    'sma_period' => (int) env('INDICATOR_SMA_PERIOD', 14),
    'ema_period' => (int) env('INDICATOR_EMA_PERIOD', 14),
    'rsi_period' => (int) env('INDICATOR_RSI_PERIOD', 14),

    'macd_fast_period' => (int) env('INDICATOR_MACD_FAST_PERIOD', 12),
    'macd_slow_period' => (int) env('INDICATOR_MACD_SLOW_PERIOD', 26),
    'macd_signal_period' => (int) env('INDICATOR_MACD_SIGNAL_PERIOD', 9),

    'stochastic_k_period' => (int) env('INDICATOR_STOCHASTIC_K_PERIOD', 14),
    'stochastic_d_period' => (int) env('INDICATOR_STOCHASTIC_D_PERIOD', 3),

    'bollinger_period' => (int) env('INDICATOR_BOLLINGER_PERIOD', 20),
    'bollinger_std_dev_multiplier' => (float) env('INDICATOR_BOLLINGER_STD_DEV_MULTIPLIER', 2.0),
];
