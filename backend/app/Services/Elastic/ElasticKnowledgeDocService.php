<?php

namespace App\Services\Elastic;

use Illuminate\Support\Facades\DB;
use Throwable;

class ElasticKnowledgeDocService
{
    public function __construct(
        protected ElasticClientService $elasticClientService
    ) {}

    public function reindexAll(int $chunkSize = 200): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.knowledge_docs');

        $total = 0;
        $failed = 0;
        $errors = [];

        DB::table('knowledge_docs_temp')
            ->orderBy('id')
            ->chunk($chunkSize, function ($rows) use ($client, $index, &$total, &$failed, &$errors) {
                $body = [];

                foreach ($rows as $row) {
                    $body[] = [
                        'index' => [
                            '_index' => $index,
                            '_id' => (string) $row->id,
                        ],
                    ];

                    $body[] = $this->transformRowToDocument($row);
                    $total++;
                }

                if (empty($body)) {
                    return;
                }

                try {
                    $response = $client->bulk([
                        'body' => $body,
                        'refresh' => false,
                    ])->asArray();

                    if (!empty($response['errors'])) {
                        foreach (($response['items'] ?? []) as $item) {
                            $indexResult = $item['index'] ?? null;
                            if (!empty($indexResult['error'])) {
                                $failed++;
                                $errors[] = [
                                    'id' => $indexResult['_id'] ?? null,
                                    'error' => $indexResult['error'],
                                ];
                            }
                        }
                    }
                } catch (Throwable $e) {
                    $failed += (int) floor(count($body) / 2);
                    $errors[] = [
                        'bulk_exception' => $e->getMessage(),
                    ];
                }
            });

        try {
            $client->indices()->refresh(['index' => $index]);
        } catch (Throwable $e) {
            $errors[] = [
                'refresh_exception' => $e->getMessage(),
            ];
        }

        return [
            'success' => true,
            'index' => $index,
            'total_processed' => $total,
            'failed' => $failed,
            'errors' => $errors,
        ];
    }

    public function upsert(array $payload): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.knowledge_docs');

        $id = (string) ($payload['id'] ?? '');

        return $client->index([
            'index' => $index,
            'id' => $id,
            'body' => [
                'id' => $id,
                'hash_key' => $payload['hash_key'] ?? null,
                'title' => $payload['title'] ?? null,
                'content' => $payload['content'] ?? null,
                'published_at' => $payload['published_at'] ?? null,
                'image' => $payload['image'] ?? null,
                'category' => $payload['category'] ?? null,
                'symbol' => $payload['symbol'] ?? null,
                'source' => $payload['source'] ?? null,
                'author' => $payload['author'] ?? null,
                'language' => $payload['language'] ?? null,
                'created_at' => $payload['created_at'] ?? null,
                'updated_at' => $payload['updated_at'] ?? null,
                'is_processed' => $this->toBool($payload['is_processed'] ?? false),
            ],
            'refresh' => true,
        ])->asArray();
    }

    public function delete(string $id): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.knowledge_docs');

        return $client->delete([
            'index' => $index,
            'id' => $id,
            'refresh' => true,
        ])->asArray();
    }

    public function search(
        string $query = '',
        ?string $symbol = null,
        ?string $category = null,
        ?string $source = null,
        ?string $language = null,
        ?bool $isProcessed = null,
        int $size = 10,
        int $from = 0
    ): array {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.knowledge_docs');

        $must = [];
        $filter = [];

        if (trim($query) !== '') {
            $must[] = [
                'multi_match' => [
                    'query' => $query,
                    'fields' => [
                        'title^4',
                        'content^2',
                        'author',
                        'source',
                    ],
                    'type' => 'best_fields',
                    'operator' => 'or',
                ],
            ];
        } else {
            $must[] = ['match_all' => (object) []];
        }

        if (!empty($symbol)) {
            $filter[] = ['term' => ['symbol' => $symbol]];
        }

        if (!empty($category)) {
            $filter[] = ['term' => ['category' => $category]];
        }

        if (!empty($source)) {
            $filter[] = ['term' => ['source' => $source]];
        }

        if (!empty($language)) {
            $filter[] = ['term' => ['language' => $language]];
        }

        if ($isProcessed !== null) {
            $filter[] = ['term' => ['is_processed' => $isProcessed]];
        }

        $response = $client->search([
            'index' => $index,
            'body' => [
                'from' => $from,
                'size' => $size,
                'query' => [
                    'bool' => [
                        'must' => $must,
                        'filter' => $filter,
                    ],
                ],
                'sort' => [
                    ['_score' => ['order' => 'desc']],
                    ['published_at' => ['order' => 'desc']],
                    ['created_at' => ['order' => 'desc']],
                ],
            ],
        ])->asArray();

        return $this->formatSearchResponse($response);
    }

    public function searchBySymbol(string $symbol, int $size = 10): array
    {
        return $this->search(
            query: '',
            symbol: $symbol,
            category: null,
            source: null,
            language: null,
            isProcessed: null,
            size: $size,
            from: 0
        );
    }

    protected function transformRowToDocument(object $row): array
    {
        return [
            'id' => (string) $row->id,
            'hash_key' => $row->hash_key,
            'title' => $row->title,
            'content' => $row->content,
            'published_at' => $row->published_at,
            'image' => $row->image,
            'category' => $row->category,
            'symbol' => $row->symbol,
            'source' => $row->source,
            'author' => $row->author,
            'language' => $row->language,
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
            'is_processed' => $this->toBool($row->is_processed),
        ];
    }

    protected function formatSearchResponse(array $response): array
    {
        $hits = $response['hits']['hits'] ?? [];
        $total = $response['hits']['total']['value'] ?? 0;

        return [
            'total' => $total,
            'items' => array_map(function ($hit) {
                return [
                    'id' => $hit['_id'] ?? null,
                    'score' => $hit['_score'] ?? null,
                    'source' => $hit['_source'] ?? [],
                ];
            }, $hits),
        ];
    }

    protected function toBool(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }
}