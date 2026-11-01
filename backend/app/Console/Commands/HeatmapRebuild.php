<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Platform\Plugins\Trading\Src\Services\HeatmapService;

class HeatmapRebuild extends Command
{
    protected $signature = 'heatmap:rebuild';
    protected $description = 'Rebuild heatmap ranking';

    public function handle(HeatmapService $service)
    {
        $service->rebuildDaily();

        $this->info('Heatmap ranking rebuilt successfully');
    }
}
