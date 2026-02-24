<?php

namespace Platform\Plugins\Advisor\Src\Services;

use Illuminate\Support\Facades\Http;

class QdrantService
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $collection
    ) {
    }

    public static function fromEnv(): self
    {
        return new self(
            rtrim(env('QDRANT_URL'), '/'),
            env('QDRANT_COLLECTION', 'knowledge_chunks_v1')
        );
    }

    public function ensureCollection(int $dim, string $distance = 'Cosine'): void
    {
        $url = "{$this->baseUrl}/collections/{$this->collection}";

        $res = Http::timeout(15)->get($url);
        if ($res->successful()) {
            return; // already exists
        }

        // create
        Http::timeout(20)->put($url, [
            'vectors' => [
                'size' => $dim,
                'distance' => $distance, // Cosine | Dot | Euclid
            ],
        ])->throw();
    }

    public function upsert(string|int $pointId, array $vector, array $payload = []): void
    {
        $url = "{$this->baseUrl}/collections/{$this->collection}/points?wait=true";

        Http::timeout(30)->put($url, [
            'points' => [
                [
                    'id' => is_int($pointId) ? $pointId : (string) $pointId, // use chunk id
                    'vector' => $vector,
                    'payload' => $payload,
                ],
            ],
        ])->throw();
    }

    public function search(array $vector, int $limit = 10, array $filter = [], bool $withVector = false): array
    {
        $url = "{$this->baseUrl}/collections/{$this->collection}/points/search";

        $body = [
            'vector' => $vector,
            'limit' => $limit,
            'with_payload' => true,
            'with_vector' => $withVector,
        ];

        if (!empty($filter)) {
            $body['filter'] = $filter;
        }

        $json = Http::timeout(30)->post($url, $body)->throw()->json();

        return $json['result'] ?? [];
    }

    public function setPayload(array $pointIds, array $payload): void
    {
        $url = "{$this->baseUrl}/collections/{$this->collection}/points/payload?wait=true";

        Http::timeout(30)->post($url, [
            'payload' => $payload,
            'points' => array_values($pointIds),
        ])->throw();
    }
}