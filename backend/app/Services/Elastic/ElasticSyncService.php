<?php

namespace App\Services\Elastic;

use Illuminate\Support\Facades\DB;
use Throwable;

class ElasticSyncService
{
    public function __construct(
        protected ElasticClientService $elasticClientService
    ) {}

    public function syncKnowledgeDocs(int $chunkSize = 200): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.knowledge_docs');

        $total = 0;

        DB::table('knowledge_docs_temp')
            ->orderBy('id')
            ->chunk($chunkSize, function ($rows) use ($client, $index, &$total) {
                $body = [];

                foreach ($rows as $row) {
                    $body[] = [
                        'index' => [
                            '_index' => $index,
                            '_id' => $row->id,
                        ],
                    ];

                    $body[] = [
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
                        'is_processed' => (bool) $row->is_processed,
                    ];

                    $total++;
                }

                if (!empty($body)) {
                    $client->bulk(['body' => $body]);
                }
            });

        return [
            'success' => true,
            'message' => 'Knowledge docs synced successfully.',
            'total_indexed' => $total,
        ];
    }

    public function syncCompanyProfiles(int $chunkSize = 200): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.company_profiles');

        $total = 0;

        DB::table('company_profile')
            ->orderBy('instrument_id')
            ->chunk($chunkSize, function ($rows) use ($client, $index, &$total) {
                $body = [];

                foreach ($rows as $row) {
                    $docId = $row->instrument_id ?: md5(($row->symbol ?? '') . '|' . ($row->company_name ?? ''));

                    $body[] = [
                        'index' => [
                            '_index' => $index,
                            '_id' => $docId,
                        ],
                    ];

                    $body[] = [
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
                        'full_time_employees' => $row->full_time_employees,
                        'ipo_date' => $row->ipo_date,
                        'created_at' => $row->created_at,
                        'updated_at' => $row->updated_at,
                    ];

                    $total++;
                }

                if (!empty($body)) {
                    $client->bulk(['body' => $body]);
                }
            });

        return [
            'success' => true,
            'message' => 'Company profiles synced successfully.',
            'total_indexed' => $total,
        ];
    }

    public function syncAll(int $chunkSize = 200): array
    {
        return [
            'knowledge_docs' => $this->syncKnowledgeDocs($chunkSize),
            'company_profiles' => $this->syncCompanyProfiles($chunkSize),
        ];
    }
}