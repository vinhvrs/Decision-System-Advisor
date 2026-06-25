<?php

return [
    'paths' => ['api/*', 'chatbot/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://dss-bice-chi-app.vercel.app',
    ],
    // Next.js dev may bind to localhost, 127.0.0.1, or a LAN IP — allow all common local origins.
    'allowed_origins_patterns' => [
        '#^http://localhost(:\d+)?$#',
        '#^http://127\.0\.0\.1(:\d+)?$#',
        '#^http://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$#',
        '#^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$#',
        '#^https://.*\.vercel\.app$#',
    ],
    'allowed_headers' => ['*'],
    'supports_credentials' => true,
];
