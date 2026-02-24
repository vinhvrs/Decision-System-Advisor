<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class NewsQdrantUpsert extends Command
{
    protected $signature = 'news:qdrant-upsert {limit=200}';
    protected $description = 'Upsert embedded knowledge_chunks vectors to Qdrant';

    public function handle(): int
    {
        $limit = (int) $this->argument('limit');

        $qdrantUrl = rtrim(env('QDRANT_URL', 'http://dsa-qdrant:6333'), '/');
        $collection = env('QDRANT_COLLECTION', 'knowledge_chunks_v1');

        // Ensure collection (dim fixed: 384)
        Http::timeout(20)->put("$qdrantUrl/collections/$collection", [
            'vectors' => ['size' => 384, 'distance' => 'Cosine'],
        ]);

        $chunks = DB::table('knowledge_chunks')
            ->whereNotNull('vector')
            ->whereNull('qdrant_upserted_at')
            ->limit($limit)
            ->get();

        if ($chunks->isEmpty()) {
            $this->info('No chunks to upsert.');
            return self::SUCCESS;
        }

        foreach ($chunks as $chunk) {
            $vector = json_decode($chunk->vector, true);

            if (!is_array($vector) || count($vector) !== 384) {
                $this->warn("Skip {$chunk->id}: invalid vector");
                continue;
            }

            $meta = json_decode($chunk->data ?? '{}', true);
            $meta = is_array($meta) ? $meta : [];

            $symbol =
                data_get($meta, 'symbol')
                ?? data_get($meta, 'ticker')
                ?? data_get($meta, 'symbols.0')
                ?? data_get($meta, 'tickers.0')
                ?? null;

            if (is_array($symbol)) {
                $symbol = $symbol[0] ?? null;
            }

            $symbol = is_string($symbol) ? strtoupper(trim($symbol)) : null;

            $payload = [
                'chunk_id' => (string) $chunk->id,
                'docs_id' => (string) $chunk->docs_id,
                'knowledge_id' => $chunk->knowledge_id ? (string) $chunk->knowledge_id : null,

                'type' => $meta['type'] ?? 'news',
                'symbol' => $symbol,
                'title' => $meta['title'] ?? null,
                'url' => $meta['url'] ?? null,
                'source' => $meta['source'] ?? ($chunk->source ?? null),
                'published_at' => $meta['published_at'] ?? null,
                'tags' => $meta['tags'] ?? [],
            ];

            try {
                Http::timeout(30)->put(
                    "$qdrantUrl/collections/$collection/points?wait=true",
                    [
                        'points' => [
                            [
                                'id' => (string) $chunk->id,   // UUID
                                'vector' => $vector,
                                'payload' => $payload,
                            ]
                        ]
                    ]
                )->throw();
            } catch (\Throwable $e) {
                $this->error("Upsert failed {$chunk->id}");
                continue;
            }

            DB::table('knowledge_chunks')->where('id', $chunk->id)->update([
                'qdrant_point_id' => $chunk->id,
                'qdrant_upserted_at' => now(),
            ]);


            DB::table('knowledge_chunks')
                ->whereNotNull('vector')
                ->whereNotNull('knowledge_id')
                ->limit($limit);

            $this->info("✓ Upserted {$chunk->id}");
        }

        $this->info('Qdrant upsert completed.');
        return self::SUCCESS;
    }
}