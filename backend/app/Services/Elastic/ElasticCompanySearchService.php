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
     * Includes fuzzy / typo-tolerant matching and optional term suggestions (spellcheck-style).
     */
    public function search(string $query, int $size = 20, int $from = 0, bool $withSuggest = true): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.company_profiles');

        $query = trim($query);
        if ($query === '') {
            return ['total' => 0, 'items' => [], 'suggestions' => []];
        }

        try {
            $queryUpper = strtoupper($query);
            $should = $this->buildCompanyShouldClauses($query, $queryUpper);

            $body = [
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
            ];

            if ($withSuggest && strlen($query) >= 3) {
                $body['suggest'] = [
                    'company_term' => [
                        'text' => $query,
                        'term' => [
                            'field' => 'company_name',
                            'size' => 6,
                            'suggest_mode' => 'popular',
                            'sort' => 'score',
                        ],
                    ],
                ];
            }

            $response = $client->search([
                'index' => $index,
                'body' => $body,
            ]);

            $data = $this->toArray($response);
            $formatted = $this->formatSearchResponse($data);
            $formatted['suggestions'] = $withSuggest ? $this->extractTermSuggestions($data) : [];

            return $formatted;
        } catch (Throwable $e) {
            throw $e;
        }
    }

    /**
     * Demo list: first N companies by symbol (for empty query / onboarding UI).
     */
    public function demoTopSymbols(int $limit = 20): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.company_profiles');
        $limit = max(1, min(50, $limit));

        try {
            $response = $client->search([
                'index' => $index,
                'body' => [
                    'size' => $limit,
                    'query' => ['match_all' => (object) []],
                    'sort' => [
                        ['symbol' => ['order' => 'asc']],
                    ],
                ],
            ]);

            return $this->formatSearchResponse($this->toArray($response));
        } catch (Throwable $e) {
            throw $e;
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    protected function buildCompanyShouldClauses(string $query, string $queryUpper): array
    {
        $should = [];

        // search_as_you_type: strong for partial tokens & name-like typos (e.g. “nvdia” → NVIDIA)
        $should[] = [
            'multi_match' => [
                'query' => $query,
                'type' => 'bool_prefix',
                'fields' => [
                    'company_search_sayt^3',
                    'company_search_sayt._2gram',
                    'company_search_sayt._3gram',
                ],
                'boost' => 4,
            ],
        ];

        // Edge n-grams on ticker (partial symbol match)
        if ($queryUpper !== '') {
            $edgeQ = strlen($queryUpper) <= 12 ? $queryUpper : substr($queryUpper, 0, 12);
            $should[] = [
                'match' => [
                    'symbol.edge' => [
                        'query' => $edgeQ,
                        'boost' => 5.5,
                    ],
                ],
            ];
        }

        // Denormalized catch-all (symbol + name + sector + industry + description snippet)
        $should[] = [
            'match' => [
                'search_all' => [
                    'query' => $query,
                    'boost' => 2,
                    'operator' => 'or',
                ],
            ],
        ];

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

        if (strlen($queryUpper) >= 2 && strlen($queryUpper) <= 6) {
            $should[] = [
                'wildcard' => [
                    'symbol' => [
                        'value' => '*'.$queryUpper.'*',
                        'boost' => 0.8,
                        'case_insensitive' => true,
                    ],
                ],
            ];
        }

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

        // Fuzzy: names, blended blob, and long description
        $should[] = [
            'multi_match' => [
                'query' => $query,
                'fields' => [
                    'company_name^2',
                    'search_all^1.2',
                    'description',
                ],
                'type' => 'best_fields',
                'fuzziness' => 'AUTO',
                'prefix_length' => 0,
                'boost' => 1.2,
            ],
        ];

        return $should;
    }

    /**
     * @return list<string>
     */
    protected function extractTermSuggestions(array $response): array
    {
        $out = [];
        $seen = [];
        $buckets = $response['suggest']['company_term'] ?? [];

        foreach ($buckets as $entry) {
            foreach ($entry['options'] ?? [] as $opt) {
                $text = $opt['text'] ?? null;
                if (! is_string($text) || $text === '') {
                    continue;
                }
                $k = strtolower($text);
                if (isset($seen[$k])) {
                    continue;
                }
                $seen[$k] = true;
                $out[] = $text;
            }
        }

        return array_slice($out, 0, 8);
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
