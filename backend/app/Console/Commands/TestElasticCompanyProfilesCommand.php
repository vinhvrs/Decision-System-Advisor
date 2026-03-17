<?php

namespace App\Console\Commands;

use Elasticsearch\ClientBuilder;
use Illuminate\Console\Command;

class TestElasticCompanyProfilesCommand extends Command
{
    protected $signature = 'elastic:test-company-profiles {--recreate : Delete and recreate the index before testing}';
    protected $description = 'Test Elasticsearch connection using the company_profiles index';

    public function handle(): int
    {
        $host = env('ELASTIC_HOST', 'http://host.docker.internal:9200');
        $hosts = array_filter(array_map('trim', explode(',', $host)));
        $index = env('ELASTIC_INDEX_COMPANY', 'company_profiles');

        try {
            $this->info('Checking Elasticsearch connection...');
            $this->line('Host: ' . $host);
            $this->line('Index: ' . $index);

            $client = ClientBuilder::create()
                ->setHosts($hosts)
                ->build();

            $ping = $client->ping();

            if (!$ping) {
                $this->error('Elasticsearch ping failed.');
                return self::FAILURE;
            }

            $this->info('Elasticsearch connection OK.');

            if ($this->option('recreate')) {
                if ($client->indices()->exists(['index' => $index])) {
                    $client->indices()->delete(['index' => $index]);
                    $this->warn("Deleted existing index [$index].");
                }
            }

            if (!$client->indices()->exists(['index' => $index])) {
                $this->info("Creating index [$index]...");

                $client->indices()->create([
                    'index' => $index,
                    'body' => [
                        'settings' => [
                            'number_of_shards' => 1,
                            'number_of_replicas' => 0,
                        ],
                        'mappings' => [
                            'properties' => [
                                'instrument_id' => ['type' => 'keyword'],
                                'exchange' => ['type' => 'keyword'],
                                'company_name' => [
                                    'type' => 'text',
                                    'fields' => [
                                        'keyword' => ['type' => 'keyword', 'ignore_above' => 256],
                                    ],
                                ],
                                'symbol' => ['type' => 'keyword'],
                                'industry' => ['type' => 'keyword'],
                                'sector' => ['type' => 'keyword'],
                                'website' => ['type' => 'keyword'],
                                'description' => ['type' => 'text'],
                                'ceo' => ['type' => 'keyword'],
                                'country' => ['type' => 'keyword'],
                                'image' => ['type' => 'keyword', 'ignore_above' => 1024],
                                'full_time_employees' => ['type' => 'integer'],
                                'ipo_date' => ['type' => 'date', 'format' => 'strict_date_optional_time||yyyy-MM-dd'],
                                'created_at' => ['type' => 'date', 'format' => 'strict_date_optional_time||yyyy-MM-dd HH:mm:ss||yyyy-MM-dd'],
                                'updated_at' => ['type' => 'date', 'format' => 'strict_date_optional_time||yyyy-MM-dd HH:mm:ss||yyyy-MM-dd'],
                            ],
                        ],
                    ],
                ]);

                $this->info("Index [$index] created successfully.");
            } else {
                $this->info("Index [$index] already exists.");
            }

            $sampleDoc = [
                'instrument_id' => 'test-instrument-001',
                'exchange' => 'NASDAQ',
                'company_name' => 'NVIDIA Corporation',
                'symbol' => 'NVDA',
                'industry' => 'Semiconductors',
                'sector' => 'Technology',
                'website' => 'https://www.nvidia.com',
                'description' => 'NVIDIA designs GPUs and AI computing platforms.',
                'ceo' => 'Jensen Huang',
                'country' => 'USA',
                'image' => 'https://example.com/nvda.png',
                'full_time_employees' => 29600,
                'ipo_date' => '1999-01-22',
                'created_at' => now()->format('Y-m-d H:i:s'),
                'updated_at' => now()->format('Y-m-d H:i:s'),
            ];

            $this->info('Indexing sample document...');

            $client->index([
                'index' => $index,
                'id' => $sampleDoc['instrument_id'],
                'body' => $sampleDoc,
                'refresh' => true,
            ]);

            $this->info('Sample document indexed successfully.');

            $this->info('Running test search...');

            $searchResponse = $client->search([
                'index' => $index,
                'body' => [
                    'size' => 5,
                    'query' => [
                        'multi_match' => [
                            'query' => 'NVIDIA NVDA AI',
                            'fields' => [
                                'company_name^3',
                                'symbol^4',
                                'description^2',
                                'sector',
                                'industry',
                            ],
                            'type' => 'best_fields',
                        ],
                    ],
                ],
            ]);

            $hits = $searchResponse['hits']['hits'] ?? [];
            $this->info('Search completed. Total hits returned: ' . count($hits));

            foreach ($hits as $i => $hit) {
                $source = $hit['_source'] ?? [];

                $this->line('');
                $this->line('Result #' . ($i + 1));
                $this->line('- ID: ' . ($hit['_id'] ?? 'N/A'));
                $this->line('- Score: ' . ($hit['_score'] ?? 'N/A'));
                $this->line('- Company: ' . ($source['company_name'] ?? 'N/A'));
                $this->line('- Symbol: ' . ($source['symbol'] ?? 'N/A'));
                $this->line('- Sector: ' . ($source['sector'] ?? 'N/A'));
            }

            $this->info('Company profile Elasticsearch test completed successfully.');

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('Elasticsearch test failed: ' . $e->getMessage());
            return self::FAILURE;
        }
    }
}