<?php

namespace Platform\Plugins\Trading\Src\Events;

use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\Channel;

class MarketTick implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public array $candle = [];

    public function __construct(array $tick)
    {
        $symbol = $tick['symbol'] ?? null;
        $price = $tick['price'] ?? null;
        $time = $tick['time'] ?? now()->timestamp;

        if (!$symbol || !$price) {
            \Log::warning("MarketTick missing required fields: ", compact('symbol', 'price', 'time'));
        }

        $this->candle = [
            'symbol' => $tick['symbol'] ?? 'aapl',
            'time' => $tick['time'] ?? null,
            'open' => $tick['price'] ?? null,
            'high' => $tick['price'] ?? null,
            'low' => $tick['price'] ?? null,
            'close' => $tick['price'] ?? null,
        ];
    }

    public function broadcastOn(): Channel
    {
        $symbol = strtolower($this->candle['symbol'] ?? 'aapl');
        \Log::info("Broadcasting MarketTick for symbol: {$symbol}");
        return new Channel("ohlc.{$symbol}.daily");
    }

    public function broadcastAs(): string
    {
        return 'candle';
    }

    public function broadcastWith(): array
    {
        return [
            'candle' => $this->candle,
        ];
    }
}
