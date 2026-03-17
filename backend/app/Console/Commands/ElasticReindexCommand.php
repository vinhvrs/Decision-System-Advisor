<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\Elastic\ElasticSyncService;

class ElasticReindexCommand extends Command
{
    protected $signature = 'elastic:reindex {target=all : knowledge_docs|company_profiles|all} {--chunk=200}';
    protected $description = 'Reindex data from MySQL to Elasticsearch';

    public function handle(ElasticSyncService $syncService): int
    {
        $target = $this->argument('target');
        $chunkSize = (int) $this->option('chunk');

        switch ($target) {
            case 'knowledge_docs':
                $result = $syncService->syncKnowledgeDocs($chunkSize);
                break;

            case 'company_profiles':
                $result = $syncService->syncCompanyProfiles($chunkSize);
                break;

            case 'all':
            default:
                $result = $syncService->syncAll($chunkSize);
                break;
        }

        $this->line(json_encode($result, JSON_PRETTY_PRINT));

        return self::SUCCESS;
    }
}