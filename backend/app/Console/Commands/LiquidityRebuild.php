<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Platform\Plugins\Trading\Src\Services\LiquidityService;

class LiquidityRebuild extends Command
{
    protected $signature = 'liquidity:rebuild';
    protected $description = 'Rebuild liquidity ranking';

    public function handle(LiquidityService $service)
    {
        $service->rebuildDaily();

        $this->info('Liquidity ranking rebuilt successfully');
    }
}
