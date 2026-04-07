<?php

/**
 * Response/cache TTLs for read-heavy endpoints (tune via .env).
 * Use CACHE_STORE=file or redis for best results; database cache still helps vs repeating heavy queries.
 */
return [
    'elastic_get_ttl' => (int) env('PERF_ELASTIC_GET_TTL', 60),
    'elastic_health_ttl' => (int) env('PERF_ELASTIC_HEALTH_TTL', 10),
    'admin_list_ttl' => (int) env('PERF_ADMIN_LIST_TTL', 45),
    'stats_most_watched_ttl' => (int) env('PERF_STATS_MOST_WATCHED_TTL', 120),
];
