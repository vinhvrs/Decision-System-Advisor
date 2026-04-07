<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'fmp' => [
        'key' => env('FMP_API_KEY'),
    ],

    'elastic' => [
        'host' => env('ELASTIC_HOST', 'http://127.0.0.1:9200'),
        'index' => env('ELASTIC_INDEX', 'dsa_entities'),
    ],

    'embedding' => [
        'url' => env('EMBEDDING_SERVICE_URL', 'http://127.0.1:8000'),
    ],

    /*
    | Optional Gmail OAuth (API / future XOAUTH2). Core Laravel SMTP still uses MAIL_USERNAME + MAIL_PASSWORD
    | (Gmail app password). These are stored for reference or custom integrations only.
    */
    'mail_google' => [
        'client_id' => env('MAIL_CLIENT_ID'),
        'client_secret' => env('MAIL_CLIENT_SECRET'),
    ],

];
