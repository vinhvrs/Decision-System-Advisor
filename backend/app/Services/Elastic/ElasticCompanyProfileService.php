<?php

namespace App\Services\Elastic;

use App\Support\DsaTables;
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

        DB::table(DsaTables::name('company_profile'))
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

        $doc = ElasticSyncService::buildCompanyProfileDocument($payload);
        $doc['full_time_employees'] = $this->toNullableInt($payload['full_time_employees'] ?? null);

        return $client->index([
            'index' => $index,
            'id' => $docId,
            'body' => $doc,
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
                        'company_search_sayt^3',
                        'search_all^2',
                        'symbol^5',
                        'symbol.edge^4',
                        'description^2',
                        'sector',
                        'industry',
                        'ceo',
                    ],
                    'type' => 'best_fields',
                    'operator' => 'or',
                    'fuzziness' => 'AUTO',
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
        $doc = ElasticSyncService::buildCompanyProfileDocument($row);
        $doc['full_time_employees'] = $this->toNullableInt($row->full_time_employees);

        return $doc;
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