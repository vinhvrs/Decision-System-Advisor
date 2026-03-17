<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\Elastic\ElasticIndexService;
use App\Services\Elastic\ElasticSyncService;

class ElasticSetupCommand extends Command
{
    protected $signature = 'elastic:setup {--sync : Sync data after creating indices} {--chunk=200 : Chunk size for sync}';
    protected $description = 'Create Elasticsearch indices and optionally sync data from MySQL';

    public function handle(
        ElasticIndexService $indexService,
        ElasticSyncService $syncService
    ): int {
        $this->info('Creating indices...');

        $result = $indexService->createAll();
        $this->line(json_encode($result, JSON_PRETTY_PRINT));

        if ($this->option('sync')) {
            $this->info('Syncing data...');
            $syncResult = $syncService->syncAll((int) $this->option('chunk'));
            $this->line(json_encode($syncResult, JSON_PRETTY_PRINT));
        }

        $this->info('Done.');

        return self::SUCCESS;
    }
}