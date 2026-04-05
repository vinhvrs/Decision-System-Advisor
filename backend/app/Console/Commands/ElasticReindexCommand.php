<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\Elastic\ElasticIndexService;
use App\Services\Elastic\ElasticSyncService;

class ElasticReindexCommand extends Command
{
    protected $signature = 'elastic:reindex {target=all : knowledge_docs|company_profiles|all} {--chunk=200} {--recreate : With company_profiles or all: drop & recreate company index first (new mapping)}';
    protected $description = 'Reindex data from MySQL to Elasticsearch';

    public function handle(ElasticIndexService $indexService, ElasticSyncService $syncService): int
    {
        $target = $this->argument('target');
        $chunkSize = (int) $this->option('chunk');

        if ($this->option('recreate') && in_array($target, ['company_profiles', 'all'], true)) {
            $this->warn('Recreating company_profiles index before bulk sync...');
            $this->line(json_encode($indexService->recreateCompanyProfilesIndex(), JSON_PRETTY_PRINT));
        }

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