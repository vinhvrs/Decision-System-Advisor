<?php
namespace Platform\Plugins\Advisor\Src\Services;

use Elasticsearch\Client;
use Elasticsearch\ClientBuilder;

class ElasticsearchEntityService
{
    protected Client $client;

    public function __construct()
    {
        $this->client = ClientBuilder::create()
            ->setHosts(['localhost:9200'])
            ->build();
    }

    public function getMarketData(string $symbol): array
    {
        // placeholder; replace with a real index mapping when wired up
        return [
            'symbol' => $symbol,
            'price' => null,
            'volume' => null,
            'ohlcv' => null,
            'source' => 'elasticsearch',
        ];
    }

    public function import(array $items): array
    {
        if (empty($items)) {
            return [
                'imported' => 0,
                'errors' => [],
            ];
        }

        $params = ['body' => []];

        foreach ($items as $item) {
            $params['body'][] = [
                'index' => [
                    '_index' => 'entities',
                    '_id' => $item['id'] ?? null,
                ]
            ];

            $params['body'][] = $item;
        }

        $response = $this->client->bulk($params);

        return [
            'imported' => count($items),
            'errors' => $response['errors'] ?? false,
        ];
    }

    /**
     * Resolve entity by keyword (autocomplete / search)
     */
    public function resolve(string $query, string $type = 'company', int $size = 5): array
    {
        $params = [
            'index' => 'entities',
            'size' => $size,
            'body' => [
                'query' => [
                    'bool' => [
                        'must' => [
                            [
                                'multi_match' => [
                                    'query' => $query,
                                    'fields' => ['name^3', 'symbol^5', 'aliases'],
                                ],
                            ],
                        ],
                        'filter' => [
                            ['term' => ['type' => $type]],
                        ],
                    ],
                ],
            ],
        ];

        $response = $this->client->search($params);

        return array_map(
            fn($hit) => [
                'id' => $hit['_id'],
                'score' => $hit['_score'],
                'source' => $hit['_source'],
            ],
            $response['hits']['hits'] ?? []
        );
    }
}
