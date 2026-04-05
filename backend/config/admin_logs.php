<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Log files for the admin "terminal" viewer (tail of last bytes)
    |--------------------------------------------------------------------------
    |
    | PHP: Laravel log (default).
    | Python: point to a file your engine writes, or mount Docker logs into storage.
    | Frontend: optional Next.js / build log, or a file your dev process appends to.
    |
    */
    'php' => env('ADMIN_LOG_PHP', storage_path('logs/laravel.log')),

    'python' => env(
        'ADMIN_LOG_PYTHON',
        base_path('python_engine/storage/logs/engine.log')
    ),

    'frontend' => env('ADMIN_LOG_FRONTEND', storage_path('logs/frontend.log')),

    'max_bytes' => (int) env('ADMIN_LOG_MAX_BYTES', 120_000),
];
