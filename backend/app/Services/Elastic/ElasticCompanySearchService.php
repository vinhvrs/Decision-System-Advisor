<?php

namespace App\Services\Elastic;

use Throwable;

/**
 * Elasticsearch service for searching companies by name or symbol.
 * Optimized for autocomplete and quick lookup use cases.
 */
class ElasticCompanySearchService
{
    public function __construct(
        protected ElasticClientService $elasticClientService
    ) {}

    /**
     * Search companies by name or symbol.
     * Query matches both company_name and symbol with symbol boosted higher for exact matches.
     */
    public function search(string $query, int $size = 20, int $from = 0): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.company_profiles');

        $query = trim($query);
        if ($query === '') {
            return ['total' => 0, 'items' => []];
        }

        try {
            $queryUpper = strtoupper($query);
            $should = [];

            // symbol is keyword: use prefix and term (exact)
            $should[] = [
                'prefix' => [
                    'symbol' => [
                        'value' => $queryUpper,
                        'boost' => 5,
                    ],
                ],
            ];
            $should[] = [
                'term' => [
                    'symbol' => [
                        'value' => $queryUpper,
                        'boost' => 6,
                    ],
                ],
            ];

            // company_name is text: use match and match_phrase_prefix
            $should[] = [
                'match' => [
                    'company_name' => [
                        'query' => $query,
                        'boost' => 3,
                        'operator' => 'or',
                    ],
                ],
            ];
            $should[] = [
                'match_phrase_prefix' => [
                    'company_name' => [
                        'query' => $query,
                        'boost' => 2,
                    ],
                ],
            ];

            $response = $client->search([
                'index' => $index,
                'body' => [
                    'from' => $from,
                    'size' => $size,
                    'query' => [
                        'bool' => [
                            'should' => $should,
                            'minimum_should_match' => 1,
                        ],
                    ],
                    'sort' => [
                        ['_score' => ['order' => 'desc']],
                        ['company_name.keyword' => ['order' => 'asc']],
                    ],
                ],
            ]);

            return $this->formatSearchResponse($this->toArray($response));
        } catch (Throwable $e) {
            throw $e;
        }
    }

    /**
     * Find company by exact symbol.
     */
    public function findBySymbol(string $symbol): ?array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.company_profiles');

        $symbol = strtoupper(trim($symbol));
        if ($symbol === '') {
            return null;
        }

        try {
            $response = $client->search([
                'index' => $index,
                'body' => [
                    'size' => 1,
                    'query' => [
                        'term' => [
                            'symbol' => $symbol,
                        ],
                    ],
                ],
            ]);

            $data = $this->toArray($response);
            $hits = $data['hits']['hits'] ?? [];
            $hit = $hits[0] ?? null;

            return $hit ? [
                'id' => $hit['_id'] ?? null,
                'score' => $hit['_score'] ?? null,
                'source' => $hit['_source'] ?? [],
            ] : null;
        } catch (Throwable $e) {
            throw $e;
        }
    }

    /**
     * Check if Elasticsearch is reachable.
     */
    public function ping(): bool
    {
        try {
            $client = $this->elasticClientService->client();
            $result = $client->ping();
            return is_array($result) ? true : (method_exists($result, 'asBool') ? $result->asBool() : (bool) $result);
        } catch (Throwable $e) {
            return false;
        }
    }

    /**
     * Get cluster health info.
     */
    public function health(): array
    {
        try {
            $client = $this->elasticClientService->client();
            $health = $this->toArray($client->cluster()->health());
            $info = $this->toArray($client->info());

            return [
                'status' => $health['status'] ?? 'unknown',
                'cluster_name' => $health['cluster_name'] ?? null,
                'number_of_nodes' => $health['number_of_nodes'] ?? 0,
                'version' => $info['version']['number'] ?? null,
            ];
        } catch (Throwable $e) {
            return [
                'status' => 'error',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Normalize Elasticsearch response (handles both array and Response object).
     */
    protected function toArray(mixed $response): array
    {
        if (is_array($response)) {
            return $response;
        }
        return method_exists($response, 'asArray') ? $response->asArray() : (array) $response;
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
}
