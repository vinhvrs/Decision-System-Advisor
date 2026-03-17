<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Elasticsearch Hosts
    |--------------------------------------------------------------------------
    |
    | Comma-separated hosts are supported via ELASTIC_HOST.
    | Example:
    | ELASTIC_HOST=http://host.docker.internal:9200
    | or
    | ELASTIC_HOST=http://elasticsearch:9200
    |
    */

    'hosts' => array_filter(array_map('trim', explode(
        ',',
        env('ELASTIC_HOST', 'http://host.docker.internal:9200')
    ))),

    /*
    |--------------------------------------------------------------------------
    | Elasticsearch Indices
    |--------------------------------------------------------------------------
    |
    | Central place for index names used across the application.
    |
    */

    'indices' => [
        'knowledge_docs'   => env('ELASTIC_INDEX_KNOWLEDGE_DOCS', 'knowledge_docs'),
        'company_profiles' => env('ELASTIC_INDEX_COMPANY_PROFILES', 'company_profiles'),
        'news_articles'    => env('ELASTIC_INDEX_NEWS_ARTICLES', 'knowledge_docs_temp'),
        'entities'         => env('ELASTIC_INDEX_ENTITIES', 'dsa_entities'),
    ],

];