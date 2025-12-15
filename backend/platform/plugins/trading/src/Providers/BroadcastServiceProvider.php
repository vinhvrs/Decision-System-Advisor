<?php

namespace Platform\Plugins\Trading\Src\Providers;

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\ServiceProvider;

class BroadcastServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Khởi tạo broadcast routes (Reverb/Pusher)
        Broadcast::routes();

        // Load file định nghĩa channel
        require base_path('platform/plugins/trading/src/Routes/channels.php');
    }
}
