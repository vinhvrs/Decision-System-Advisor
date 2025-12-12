<?php

namespace Platform\Plugins\Trading\Src\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MarketTick implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $tick;

    public function __construct(array $tick)
    {
        $this->tick = $tick;
    }

    public function broadcastOn(): Channel
    {
        return new Channel('market.' . $this->tick['symbol']);
    }

    public function broadcastAs(): string
    {
        return 'tick';
    }
}
