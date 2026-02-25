<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Platform\Plugins\Advisor\Src\Services\QdrantService;
use Platform\Plugins\Advisor\Src\Services\EmbeddingService;


class EmbedNewsChunks extends Command
{
    protected $signature = 'news:embed-chunks {limit=100}';
    protected $description = 'Generate vector embeddings for knowledge_chunks + upsert to Qdrant';

    private QdrantService $qdrant;

    public function __construct(private EmbeddingService $embedding)
    {
        parent::__construct();
        $this->qdrant = QdrantService::fromEnv();
    }

    public function handle()
    {
        $limit = (int) $this->argument('limit');

        $chunks = DB::table('knowledge_chunks')
            ->whereNull('vector')
            ->limit($limit)
            ->get();

        if ($chunks->isEmpty()) {
            $this->info("No chunks to embed.");
            return;
        }

        foreach ($chunks as $chunk) {

            $text = $this->normalize($chunk->content);

            try {
                $emb = $this->embedding->embed($text);
            } catch (\Exception $e) {
                $this->error("Embedding failed for {$chunk->id}");
                continue;
            }

            $vector = $emb['vector'] ?? null;
            if (!$vector) {
                $this->warn("No vector returned for {$chunk->id}");
                continue;
            }

            $dim = (int) ($emb['dim'] ?? count($vector));
            $meta = json_decode($chunk->data, true) ?: [];

            // 1) ensure collection exists
            try {
                $this->qdrant->ensureCollection($dim);
            } catch (\Exception $e) {
                $this->error("Qdrant ensureCollection failed (dim=$dim)");
                continue;
            }

            // 2) upsert to qdrant
            $symbol = $meta['symbol'] ?? $meta['ticker'] ?? null;

            $payload = [
                'chunk_id' => (string) $chunk->id,
                'docs_id' => (string) ($chunk->docs_id ?? ($meta['docs_id'] ?? null)),
                'knowledge_id' => $chunk->knowledge_id ? (string) $chunk->knowledge_id : null,

                'type' => $meta['type'] ?? 'news',
                'symbol' => $symbol, // ✅ filter luôn theo symbol, nhưng lấy từ ticker nếu cần

                'title' => $meta['title'] ?? null,
                'url' => $meta['url'] ?? null,
                'source' => $chunk->source ?? ($meta['source'] ?? null),

                // event_date đang có sẵn trong data của bạn
                'published_at' => $meta['published_at'] ?? $meta['event_date'] ?? null,
                'tags' => $meta['tags'] ?? [],
            ];

            try {
                $this->qdrant->upsert($chunk->id, $vector, $payload);
            } catch (\Exception $e) {
                $this->error("Qdrant upsert failed for {$chunk->id}");
                continue;
            }

            // 3) save back to mysql (optional but ok)
            $meta['vector_model'] = $emb['model'] ?? null;
            $meta['vector_dim'] = $dim;
            $meta['vector_at'] = now()->toISOString();
            $meta['status'] = 'embedded';
            $meta['qdrant'] = ['collection' => env('QDRANT_COLLECTION'), 'point_id' => (string) $chunk->id];

            DB::table('knowledge_chunks')
                ->where('id', $chunk->id)
                ->update([
                    'vector' => json_encode($vector),
                    'data' => json_encode($meta)
                ]);

            $this->info("✓ Embedded + Upserted {$chunk->id}");
        }

        $this->info("Embedding + Qdrant upsert completed.");
    }
}