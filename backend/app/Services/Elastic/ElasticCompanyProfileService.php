<?php

namespace App\Services\Elastic;

use Illuminate\Support\Facades\DB;
use Throwable;

class ElasticCompanyProfileService
{
    public function __construct(
        protected ElasticClientService $elasticClientService
    ) {}

    public function reindexAll(int $chunkSize = 200): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.company_profiles');

        $total = 0;
        $failed = 0;
        $errors = [];

        DB::table('company_profile')
            ->orderBy('instrument_id')
            ->chunk($chunkSize, function ($rows) use ($client, $index, &$total, &$failed, &$errors) {
                $body = [];

                foreach ($rows as $row) {
                    $docId = $row->instrument_id ?: md5(($row->symbol ?? '') . '|' . ($row->company_name ?? ''));

                    $body[] = [
                        'index' => [
                            '_index' => $index,
                            '_id' => $docId,
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
        $index = config('elasticsearch.indices.company_profiles');

        $docId = $payload['instrument_id']
            ?? md5(($payload['symbol'] ?? '') . '|' . ($payload['company_name'] ?? ''));

        return $client->index([
            'index' => $index,
            'id' => $docId,
            'body' => [
                'instrument_id' => $payload['instrument_id'] ?? null,
                'exchange' => $payload['exchange'] ?? null,
                'company_name' => $payload['company_name'] ?? null,
                'symbol' => $payload['symbol'] ?? null,
                'industry' => $payload['industry'] ?? null,
                'sector' => $payload['sector'] ?? null,
                'website' => $payload['website'] ?? null,
                'description' => $payload['description'] ?? null,
                'ceo' => $payload['ceo'] ?? null,
                'country' => $payload['country'] ?? null,
                'image' => $payload['image'] ?? null,
                'full_time_employees' => $this->toNullableInt($payload['full_time_employees'] ?? null),
                'ipo_date' => $payload['ipo_date'] ?? null,
                'created_at' => $payload['created_at'] ?? null,
                'updated_at' => $payload['updated_at'] ?? null,
            ],
            'refresh' => true,
        ])->asArray();
    }

    public function delete(string $id): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.company_profiles');

        return $client->delete([
            'index' => $index,
            'id' => $id,
            'refresh' => true,
        ])->asArray();
    }

    public function search(
        string $query = '',
        ?string $symbol = null,
        ?string $sector = null,
        ?string $industry = null,
        ?string $exchange = null,
        ?string $country = null,
        int $size = 10,
        int $from = 0
    ): array {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.company_profiles');

        $must = [];
        $filter = [];

        if (trim($query) !== '') {
            $must[] = [
                'multi_match' => [
                    'query' => $query,
                    'fields' => [
                        'company_name^4',
                        'symbol^5',
                        'description^2',
                        'sector',
                        'industry',
                        'ceo',
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

        if (!empty($sector)) {
            $filter[] = ['term' => ['sector' => $sector]];
        }

        if (!empty($industry)) {
            $filter[] = ['term' => ['industry' => $industry]];
        }

        if (!empty($exchange)) {
            $filter[] = ['term' => ['exchange' => $exchange]];
        }

        if (!empty($country)) {
            $filter[] = ['term' => ['country' => $country]];
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
                    ['company_name.keyword' => ['order' => 'asc']],
                ],
            ],
        ])->asArray();

        return $this->formatSearchResponse($response);
    }

    public function findBySymbol(string $symbol): ?array
    {
        $result = $this->search(
            query: '',
            symbol: $symbol,
            size: 1,
            from: 0
        );

        return $result['items'][0] ?? null;
    }

    protected function transformRowToDocument(object $row): array
    {
        return [
            'instrument_id' => $row->instrument_id,
            'exchange' => $row->exchange,
            'company_name' => $row->company_name,
            'symbol' => $row->symbol,
            'industry' => $row->industry,
            'sector' => $row->sector,
            'website' => $row->website,
            'description' => $row->description,
            'ceo' => $row->ceo,
            'country' => $row->country,
            'image' => $row->image,
            'full_time_employees' => $this->toNullableInt($row->full_time_employees),
            'ipo_date' => $row->ipo_date,
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
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

    protected function toNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }
}