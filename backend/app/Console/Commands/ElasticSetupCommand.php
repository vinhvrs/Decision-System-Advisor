<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\Elastic\ElasticIndexService;
use App\Services\Elastic\ElasticSyncService;

class ElasticSetupCommand extends Command
{
    protected $signature = 'elastic:setup {--sync : Sync data after creating indices} {--chunk=200 : Chunk size for sync} {--recreate-company : Delete and recreate company_profiles (apply new analyzers / fields)}';
    protected $description = 'Create Elasticsearch indices and optionally sync data from MySQL';

    public function handle(
        ElasticIndexService $indexService,
        ElasticSyncService $syncService
    ): int {
        $this->info('Creating indices...');

        if ($this->option('recreate-company')) {
            $this->warn('Recreating company_profiles index (drop + create)...');
            $companyResult = $indexService->recreateCompanyProfilesIndex();
            $this->line(json_encode($companyResult, JSON_PRETTY_PRINT));
        }

        $result = $indexService->createKnowledgeDocsIndex();
        $this->line(json_encode(['knowledge_docs' => $result], JSON_PRETTY_PRINT));

        if (! $this->option('recreate-company')) {
            $companyResult = $indexService->createCompanyProfilesIndex();
            $this->line(json_encode(['company_profiles' => $companyResult], JSON_PRETTY_PRINT));
        }

        if ($this->option('sync')) {
            $this->info('Syncing data...');
            $syncResult = $syncService->syncAll((int) $this->option('chunk'));
            $this->line(json_encode($syncResult, JSON_PRETTY_PRINT));
        }

        $this->info('Done.');

        return self::SUCCESS;
    }
}