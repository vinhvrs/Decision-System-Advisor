<?php

namespace App\Console\Commands;

use Platform\Plugins\Trading\Src\Services\NewsCrawlerService;
use Illuminate\Console\Command;

class CrawlNews extends Command
{
    protected $signature = 'crawl:news
        {--source=yahoo_rss : Source key (used in crawler_states.source)}
        {--chunk=500 : Number of symbols per batch}
        {--after= : Start after this symbol (alphabet paging)}
        {--batches=1 : How many batches to run in this execution}';

    protected $description = 'Crawl news for symbols from instruments/company_profile using crawler_states checkpoint';

    public function __construct(protected NewsCrawlerService $service)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $source  = (string) $this->option('source');
        $chunk   = (int) $this->option('chunk');
        $after   = $this->option('after') ? (string) $this->option('after') : null;
        $batches = (int) $this->option('batches');

        $this->info("crawl:news | source={$source} chunk={$chunk} after=" . ($after ?? 'NULL') . " batches={$batches}");

        $cursor = $after;

        for ($i = 1; $i <= $batches; $i++) {
            $result = $this->service->crawlBatch($source, $chunk, $cursor);

            $this->line("Batch {$i}: processed={$result['processed']} inserted={$result['inserted']} skipped={$result['skipped']} failed={$result['failed']} lastSymbol=" . ($result['lastSymbol'] ?? 'NULL'));

            // Empty batch: no more symbols
            if (empty($result['lastSymbol'])) {
                $this->info('No more symbols. Stop.');
                break;
            }

            $cursor = $result['lastSymbol'];
        }

        return self::SUCCESS;
    }
}