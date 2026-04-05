<?php

namespace App\Services\Elastic;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

class ElasticSyncService
{
    public function __construct(
        protected ElasticClientService $elasticClientService
    ) {}

    /**
     * Single company_profile document for Elasticsearch (kept in sync with index mapping).
     *
     * @param  object|array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public static function buildCompanyProfileDocument(object|array $row): array
    {
        $r = is_array($row) ? $row : get_object_vars($row);

        $name = $r['company_name'] ?? '';
        $sym = $r['symbol'] ?? '';
        $sector = $r['sector'] ?? '';
        $industry = $r['industry'] ?? '';
        $descPlain = preg_replace('/\s+/', ' ', strip_tags((string) ($r['description'] ?? '')));
        $descSnippet = Str::limit(trim($descPlain), 450, '');

        $searchAll = strtolower(trim(implode(' ', array_filter([
            $sym,
            $name,
            $sector,
            $industry,
            $descSnippet,
        ]))));

        return [
            'instrument_id' => $r['instrument_id'] ?? null,
            'exchange' => $r['exchange'] ?? null,
            'company_name' => $r['company_name'] ?? null,
            'company_search_sayt' => $name,
            'symbol' => $r['symbol'] ?? null,
            'search_all' => $searchAll,
            'industry' => $r['industry'] ?? null,
            'sector' => $r['sector'] ?? null,
            'website' => $r['website'] ?? null,
            'description' => $r['description'] ?? null,
            'ceo' => $r['ceo'] ?? null,
            'country' => $r['country'] ?? null,
            'image' => $r['image'] ?? null,
            'full_time_employees' => $r['full_time_employees'] ?? null,
            'ipo_date' => $r['ipo_date'] ?? null,
            'created_at' => $r['created_at'] ?? null,
            'updated_at' => $r['updated_at'] ?? null,
        ];
    }

    public function syncKnowledgeDocs(int $chunkSize = 200): array
    {
        $client = $this->elasticClientService->client();
        $index = config('elasticsearch.indices.knowledge_docs');

        $total = 0;

        DB::table('knowledge_docs')
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
                        'hash_key' => $row->hash_key ?? (string) $row->id,
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

                    $body[] = self::buildCompanyProfileDocument($row);

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