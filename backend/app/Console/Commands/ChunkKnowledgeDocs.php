<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ChunkKnowledgeDocs extends Command
{
    protected $signature = 'news:chunk-docs {limit=50}';
    protected $description = 'Chunk knowledge_docs into knowledge_chunks (production level)';

    public function handle()
    {
        $limit = (int)$this->argument('limit');

        $docs = DB::table('knowledge_docs')
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                  ->from('knowledge_chunks')
                  ->whereColumn('knowledge_chunks.docs_id', 'knowledge_docs.id');
            })
            ->limit($limit)
            ->get();

        if ($docs->isEmpty()) {
            $this->info("No docs to chunk.");
            return;
        }

        foreach ($docs as $doc) {

            $cleanText = $this->cleanText($doc->content);
            $sentences = $this->splitSentences($cleanText);
            $chunks = $this->buildChunks($sentences);

            foreach ($chunks as $index => $chunkText) {

                DB::table('knowledge_chunks')->insert([
                    'id'           => (string) Str::uuid(),
                    'knowledge_id' => null,
                    'docs_id'      => $doc->id,
                    'chunk_index'  => $index,
                    'content'      => $chunkText,
                    'source'       => $doc->source,
                    'token'        => ceil(strlen($chunkText) / 4),
                    'vector'       => null,
                    'data'         => json_encode([
                        'status' => 'raw_news',
                        'category' => $doc->category,
                        'language' => $doc->language,
                    ]),
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ]);
            }

            $this->info("Chunked doc: {$doc->id}");
        }

        $this->info("Chunking completed.");
    }

    private function cleanText($text)
    {
        $text = strip_tags($text);
        $text = preg_replace('/\s+/', ' ', $text);
        return trim($text);
    }

    private function splitSentences($text)
    {
        return preg_split('/(?<=[.!?])\s+(?=[A-Z])/', $text);
    }

    private function buildChunks($sentences, $maxTokens = 300, $overlap = 50)
    {
        $chunks = [];
        $current = '';
        $currentTokens = 0;

        foreach ($sentences as $sentence) {

            $sentenceTokens = ceil(strlen($sentence) / 4);

            if ($currentTokens + $sentenceTokens > $maxTokens) {

                $chunks[] = trim($current);

                $current = substr($current, -($overlap * 4));
                $currentTokens = ceil(strlen($current) / 4);
            }

            $current .= ' ' . $sentence;
            $currentTokens += $sentenceTokens;
        }

        if (!empty($current)) {
            $chunks[] = trim($current);
        }

        return $chunks;
    }
}
