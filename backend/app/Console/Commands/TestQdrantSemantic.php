<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Platform\Plugins\Advisor\Src\Services\EmbeddingService;
use Platform\Plugins\Advisor\Src\Services\Context\QdrantRetriever;
use Platform\Plugins\Advisor\Src\Services\QdrantService;

class TestQdrantSemantic extends Command
{
    protected $signature = 'qdrant:test {symbol=AAPL} {--k=5}';
    protected $description = 'Test embedding -> qdrant search -> validate semantic results (no HTTP endpoint)';

    public function handle(EmbeddingService $embedder): int
    {
        $qdrant = QdrantService::fromEnv();
        $retriever = new \Platform\Plugins\Advisor\Src\Services\Context\QdrantRetriever($qdrant);

        $symbol = strtoupper($this->argument('symbol'));
        $k = (int) $this->option('k');

        $query = "latest news about {$symbol}";
        $this->info("Query: {$query}");

        $emb = $embedder->embed($query);
        $vector = $emb['vector'] ?? $emb ?? null;

        if (!is_array($vector) || count($vector) !== 384) {
            $this->error('Embedding vector invalid. Expect 384-dim array.');
            $this->line('Got: ' . (is_array($vector) ? count($vector) : gettype($vector)));
            return self::FAILURE;
        }
        $this->info('Embedding OK (dim=384)');

        $hits = $retriever->search($vector, $k, $symbol);

        if (empty($hits)) {
            $this->warn("No hits returned for symbol={$symbol}");
            return self::SUCCESS;
        }

        $this->info("Top {$k} hits:");
        foreach ($hits as $i => $h) {
            $id = $h['id'] ?? 'N/A';
            $score = $h['score'] ?? null;
            $p = $h['payload'] ?? [];
            $pSymbol = $p['symbol'] ?? null;
            $kid = $p['knowledge_id'] ?? null;
            $src = $p['source'] ?? null;

            $this->line(sprintf(
                "#%d  id=%s  score=%.4f  payload.symbol=%s  knowledge_id=%s  source=%s",
                $i + 1,
                $id,
                (float) $score,
                $pSymbol ?? 'null',
                $kid ?? 'null',
                $src ?? 'null'
            ));
        }

        $wrong = collect($hits)->filter(fn($h) => ($h['payload']['symbol'] ?? null) !== $symbol)->count();
        if ($wrong > 0) {
            $this->error("Filter FAILED: {$wrong} hits not matching symbol={$symbol}");
            return self::FAILURE;
        }

        $this->info("Filter OK: all hits match symbol={$symbol}");

        return self::SUCCESS;
    }
}