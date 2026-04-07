<?php

namespace Platform\Plugins\Advisor\Src\Services\Context;

use Illuminate\Support\Facades\Http;

class ElasticRetriever
{
    private string $url;
    private string $index;

    public function __construct()
    {
        $this->url = rtrim(env('ELASTIC_URL', 'http://localhost:9200'), '/');
        $this->index = env('ELASTIC_INDEX', 'knowledge_docs');
    }

    public function search(string $query, int $limit = 10, ?string $symbol = null): array
    {
        $body = [
            'size' => $limit,
            'query' => [
                'bool' => [
                    'must' => [
                        [
                            'multi_match' => [
                                'query'  => $query,
                                'fields' => ['title^3', 'content'],
                            ],
                        ],
                    ],
                    'filter' => [],
                ],
            ],
            'sort' => [
                ['_score' => 'desc'],
            ],
        ];

        if ($symbol) {
            // Use (A) or (B) depending on index mapping:
            // (A) $body['query']['bool']['filter'][] = ['term' => ['symbol.keyword' => $symbol]];
            $body['query']['bool']['filter'][] = ['term' => ['data.symbol.keyword' => $symbol]];
        }

        $res = Http::timeout(20)->post(
            "{$this->url}/{$this->index}/_search",
            $body
        )->throw()->json();

        return collect($res['hits']['hits'] ?? [])
            ->map(fn ($hit) => [
                'id'      => $hit['_id'],
                'score'   => $hit['_score'],
                'payload' => $hit['_source'],
            ])
            ->toArray();
    }
}