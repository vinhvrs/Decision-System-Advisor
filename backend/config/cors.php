<?php
use Illuminate\Support\Str;

return [
    /*
    |--------------------------------------------------------------------------
    | Application URL
    |--------------------------------------------------------------------------
    |
    | This URL is used by the console to properly generate URLs when using
    | the Artisan command line tool. You should set this to the root of
    | your application so that it is used when running Artisan tasks.
    |
    */
    'paths' => ['api/*', 'chatbot/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['http://localhost:3000', 'http://127.0.0.1:3000'],
    'allowed_origins_patterns' => ['#^https://[a-z0-9-]+\\.vercel\\.app$#i'],
    'allowed_headers' => ['*'],
    'supports_credentials' => true,

];