<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Platform\Plugins\Trading\Src\Models\Instruments;
use Platform\Plugins\Trading\Src\Services\MarketMoveService;

class MarketMove extends Command
{
    protected $signature = 'market:update-movers';

    protected $description = 'Compute top gainers/losers for all stocks (chunked processing)';

    public function handle()
    {
        $this->info('Computing market movers...');

        $service = app(MarketMoveService::class);
        $count = $service->rebuildDaily();

        $this->info("Done. {$count} stocks processed.");
    }
}