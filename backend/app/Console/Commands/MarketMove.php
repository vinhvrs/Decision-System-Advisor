<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Platform\Plugins\Trading\Src\Models\Instruments;
use Platform\Plugins\Trading\Src\Services\MarketMoveService;

class MarketMove extends Command
{
    /**
     * Tên và chữ ký của lệnh console.
     * Chạy lệnh bằng cách dùng: php artisan market:update-movers
     */
    protected $signature = 'market:update-movers';

    /**
     * Mô tả lệnh.
     */
    protected $description = 'Tính toán Top Gainer/Loser cho toàn bộ stocks bằng cách chia nhỏ dữ liệu (Chunking)';

    public function handle()
    {
        $this->info('Bắt đầu tính toán Market Movers...');

        $service = app(MarketMoveService::class);
        $count = $service->rebuildDaily();

        $this->info("Done. {$count} stocks processed.");
    }
}