<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;
use Platform\Plugins\Trading\Src\Services\LiquidityService;
use Platform\Plugins\Trading\Src\Services\HeatmapService;
use Platform\Plugins\Trading\Src\Services\MarketMoveService;

class RedisInit extends Command
{
    protected $signature = 'redis:init';
    protected $description = 'Prepare Redis for DSA system';

    public function handle()
    {
        $this->info('Checking Redis connection...');

        Redis::set('ping', 'ok');

        if (Redis::get('ping') !== 'ok') {
            $this->error('Redis not responding');
            return;
        }

        $this->info('Redis OK');

        // Uncomment to wipe Redis: Redis::flushall();

        $this->info('Building liquidity...');
        app(LiquidityService::class)->rebuildDaily();

        $this->info('Building heatmap...');
        app(HeatmapService::class)->rebuildDaily();

        $this->info('Market movers updating...');
        app(MarketMoveService::class)->rebuildDaily();

        $this->info('Redis ready.');
    }
}
