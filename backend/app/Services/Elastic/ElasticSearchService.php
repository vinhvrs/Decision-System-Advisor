<?php

namespace App\Services\Elastic;

class ElasticSearchService
{
    public function __construct(
        protected ElasticClientService $elasticClientService
    ) {}

    public function searchKnowledgeDocs(
        string $query,
        ?string $symbol = null,
        ?string $category = null,
        int $size = 10
    ): array {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.knowledge_docs');

        $must = [];
        $filter = [];

        if (!empty($query)) {
            $must[] = [
                'multi_match' => [
                    'query' => $query,
                    'fields' => ['title^3', 'content'],
                    'type' => 'best_fields',
                ],
            ];
        }

        if (!empty($symbol)) {
            $filter[] = [
                'term' => ['symbol' => $symbol],
            ];
        }

        if (!empty($category)) {
            $filter[] = [
                'term' => ['category' => $category],
            ];
        }

        $params = [
            'index' => $index,
            'body' => [
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
                ],
            ],
        ];

        $response = $client->search($params);

        return $this->formatHits($response);
    }

    public function searchCompanyProfiles(string $query, int $size = 10): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.company_profiles');

        $params = [
            'index' => $index,
            'body' => [
                'size' => $size,
                'query' => [
                    'multi_match' => [
                        'query' => $query,
                        'fields' => [
                            'company_name^3',
                            'description^2',
                            'symbol^4',
                            'sector',
                            'industry',
                        ],
                        'type' => 'best_fields',
                    ],
                ],
            ],
        ];

        $response = $client->search($params);

        return $this->formatHits($response);
    }

    protected function formatHits(array $response): array
    {
        $hits = $response['hits']['hits'] ?? [];

        return array_map(function ($hit) {
            return [
                'id' => $hit['_id'] ?? null,
                'score' => $hit['_score'] ?? null,
                'source' => $hit['_source'] ?? [],
            ];
        }, $hits);
    }
}