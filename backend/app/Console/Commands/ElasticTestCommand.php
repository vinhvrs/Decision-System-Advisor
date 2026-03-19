<?php

namespace App\Console\Commands;

use App\Services\Elastic\ElasticCompanySearchService;
use Illuminate\Console\Command;

class ElasticTestCommand extends Command
{
    protected $signature = 'elastic:test {--search= : Query to test search}';
    protected $description = 'Test Elasticsearch connection and optionally run a search';

    public function handle(ElasticCompanySearchService $searchService): int
    {
        $this->info('Testing Elasticsearch connection...');

        if (!$searchService->ping()) {
            $this->error('Elasticsearch is not reachable. Check ELASTIC_HOST in .env (e.g. http://localhost:9200 or http://elasticsearch:9200)');
            return self::FAILURE;
        }

        $this->info('✓ Elasticsearch is reachable.');

        $health = $searchService->health();
        $this->table(
            ['Key', 'Value'],
            collect($health)->map(fn ($v, $k) => [$k, is_array($v) ? json_encode($v) : $v])->toArray()
        );

        $query = $this->option('search');
        if ($query) {
            $this->newLine();
            $this->info("Searching for: {$query}");
            $result = $searchService->search($query, 5);
            $this->info("Total: {$result['total']}");
            foreach ($result['items'] as $i => $item) {
                $src = $item['source'] ?? [];
                $this->line(sprintf(
                    '  %d. %s - %s (score: %s)',
                    $i + 1,
                    $src['symbol'] ?? 'N/A',
                    $src['company_name'] ?? 'N/A',
                    $item['score'] ?? 'N/A'
                ));
            }
        }

        return self::SUCCESS;
    }
}
