<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Platform\Plugins\Trading\Src\Services\WebSocketConsumer;

class ConsumeWebSocket extends Command
{
    protected $signature = 'ws:consume';
    protected $description = 'Consume data from WebSocket feed';

    public function handle()
    {
        $ws = new WebSocketConsumer();

        // Ví dụ: lấy BTC-USD, ETH-USD
        $ws->subscribe(["AAPL", "MSFT", "GOOGL"]);

        $ws->listen();
    }
}
