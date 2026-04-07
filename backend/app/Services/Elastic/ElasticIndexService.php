<?php

namespace App\Services\Elastic;

use Exception;

class ElasticIndexService
{
    public function __construct(
        protected ElasticClientService $elasticClientService
    ) {}

    public function createKnowledgeDocsIndex(): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.knowledge_docs');

        if ($client->indices()->exists(['index' => $index])) {
            return [
                'success' => true,
                'message' => "Index [$index] already exists.",
            ];
        }

        $params = [
            'index' => $index,
            'body' => [
                'settings' => [
                    'number_of_shards' => 1,
                    'number_of_replicas' => 0,
                ],
                'mappings' => [
                    'properties' => [
                        'id' => ['type' => 'keyword'],
                        'hash_key' => ['type' => 'keyword'],
                        'title' => [
                            'type' => 'text',
                            'fields' => [
                                'keyword' => ['type' => 'keyword', 'ignore_above' => 256],
                            ],
                        ],
                        'content' => ['type' => 'text'],
                        'published_at' => ['type' => 'date', 'format' => 'strict_date_optional_time||yyyy-MM-dd HH:mm:ss||yyyy-MM-dd'],
                        'image' => ['type' => 'keyword', 'ignore_above' => 1024],
                        'category' => ['type' => 'keyword'],
                        'symbol' => ['type' => 'keyword'],
                        'source' => ['type' => 'keyword'],
                        'author' => ['type' => 'keyword'],
                        'language' => ['type' => 'keyword'],
                        'created_at' => ['type' => 'date', 'format' => 'strict_date_optional_time||yyyy-MM-dd HH:mm:ss||yyyy-MM-dd'],
                        'updated_at' => ['type' => 'date', 'format' => 'strict_date_optional_time||yyyy-MM-dd HH:mm:ss||yyyy-MM-dd'],
                        'is_processed' => ['type' => 'boolean'],
                    ],
                ],
            ],
        ];

        $response = $client->indices()->create($params);

        return [
            'success' => true,
            'message' => "Index [$index] created successfully.",
            'response' => $response,
        ];
    }

    /**
     * Company index: richer analysis for ticker prefix, name typos, and “as you type” matching.
     */
    protected function companyProfilesIndexBody(): array
    {
        return [
            'settings' => [
                'number_of_shards' => 1,
                'number_of_replicas' => 0,
                'analysis' => [
                    'tokenizer' => [
                        'symbol_edge_ngram' => [
                            'type' => 'edge_ngram',
                            'min_gram' => 1,
                            'max_gram' => 12,
                            'token_chars' => ['letter', 'digit'],
                        ],
                    ],
                    'analyzer' => [
                        'symbol_edge_index' => [
                            'tokenizer' => 'symbol_edge_ngram',
                            'filter' => ['lowercase', 'asciifolding'],
                        ],
                        'symbol_edge_search' => [
                            'tokenizer' => 'keyword',
                            'filter' => ['lowercase', 'asciifolding'],
                        ],
                        'company_text' => [
                            'tokenizer' => 'standard',
                            'filter' => ['lowercase', 'asciifolding'],
                        ],
                    ],
                ],
            ],
            'mappings' => [
                'properties' => [
                    'instrument_id' => ['type' => 'keyword'],
                    'exchange' => ['type' => 'keyword'],
                    'company_name' => [
                        'type' => 'text',
                        'analyzer' => 'company_text',
                        'fields' => [
                            'keyword' => ['type' => 'keyword', 'ignore_above' => 256],
                        ],
                    ],
                    'company_search_sayt' => [
                        'type' => 'search_as_you_type',
                        'max_shingle_size' => 3,
                    ],
                    'symbol' => [
                        'type' => 'keyword',
                        'fields' => [
                            'edge' => [
                                'type' => 'text',
                                'analyzer' => 'symbol_edge_index',
                                'search_analyzer' => 'symbol_edge_search',
                            ],
                        ],
                    ],
                    'search_all' => [
                        'type' => 'text',
                        'analyzer' => 'company_text',
                    ],
                    'industry' => ['type' => 'keyword'],
                    'sector' => ['type' => 'keyword'],
                    'website' => ['type' => 'keyword'],
                    'description' => ['type' => 'text', 'analyzer' => 'company_text'],
                    'ceo' => ['type' => 'keyword'],
                    'country' => ['type' => 'keyword'],
                    'image' => ['type' => 'keyword', 'ignore_above' => 1024],
                    'full_time_employees' => ['type' => 'integer'],
                    'ipo_date' => ['type' => 'date', 'format' => 'strict_date_optional_time||yyyy-MM-dd'],
                    'created_at' => ['type' => 'date', 'format' => 'strict_date_optional_time||yyyy-MM-dd HH:mm:ss||yyyy-MM-dd'],
                    'updated_at' => ['type' => 'date', 'format' => 'strict_date_optional_time||yyyy-MM-dd HH:mm:ss||yyyy-MM-dd'],
                ],
            ],
        ];
    }

    public function createCompanyProfilesIndex(): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.company_profiles');

        if ($client->indices()->exists(['index' => $index])) {
            return [
                'success' => true,
                'message' => "Index [$index] already exists.",
            ];
        }

        $params = [
            'index' => $index,
            'body' => $this->companyProfilesIndexBody(),
        ];

        $response = $client->indices()->create($params);

        return [
            'success' => true,
            'message' => "Index [$index] created successfully.",
            'response' => $response,
        ];
    }

    /**
     * Delete and recreate the company_profiles index (required to apply mapping changes on existing clusters).
     */
    public function recreateCompanyProfilesIndex(): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.company_profiles');

        if ($client->indices()->exists(['index' => $index])) {
            $client->indices()->delete(['index' => $index]);
        }

        $params = [
            'index' => $index,
            'body' => $this->companyProfilesIndexBody(),
        ];
        $response = $client->indices()->create($params);

        return [
            'success' => true,
            'message' => "Index [$index] recreated.",
            'response' => $response,
        ];
    }

    public function createAll(): array
    {
        return [
            'knowledge_docs' => $this->createKnowledgeDocsIndex(),
            'company_profiles' => $this->createCompanyProfilesIndex(),
        ];
    }

    public function deleteIndex(string $index): array
    {
        $client = $this->elasticClientService->client();

        if (!$client->indices()->exists(['index' => $index])) {
            return [
                'success' => true,
                'message' => "Index [$index] does not exist.",
            ];
        }

        $response = $client->indices()->delete(['index' => $index]);

        return [
            'success' => true,
            'message' => "Index [$index] deleted successfully.",
            'response' => $response,
        ];
    }
}