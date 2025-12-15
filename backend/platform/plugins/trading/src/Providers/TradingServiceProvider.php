<?php
namespace Platform\Plugins\Trading\Src\Providers;

use Illuminate\Support\ServiceProvider;

class TradingServiceProvider extends ServiceProvider
{
    public function register()
    {
        // Đăng ký Provider con nếu cần
        $this->app->register(BroadcastServiceProvider::class);
    }

    public function boot()
    {
        $this->loadRoutesFrom(__DIR__ . '/../Routes/channels.php');
    }
}
