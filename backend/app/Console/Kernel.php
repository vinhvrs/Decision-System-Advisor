<?php
namespace App\Console;
use App\Console\Commands\MarketMove;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use App\Console\Commands\FetchStockAttributes;
use App\Console\Commands\DataPeriods;
use App\Console\Commands\SmoothTest;
use App\Console\Commands\LiquidityRebuild;
use App\Console\Commands\HeatmapRebuild;
use App\Console\Commands\FetchMarketNews;
use App\Console\Commands\FetchCompanyProfile;
use App\Console\Commands\ExtractNewsEvents;
use App\Console\Commands\EmbedNewsChunks;
use App\Console\Commands\TestQdrantSemantic;
use Illuminate\Support\Facades\Log;


class Kernel extends ConsoleKernel
{
    protected $commands = [
        // FetchStockAttributes::class,
        DataPeriods::class,
        FetchCompanyProfile::class,
        FetchMarketNews::class,
        SmoothTest::class,
        LiquidityRebuild::class,
        HeatmapRebuild::class,
        MarketMove::class,
        TestQdrantSemantic::class,
        ExtractNewsEvents::class,
        EmbedNewsChunks::class,
    ];
    protected $middlewareGroups = [
        'api' => [
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
            'throttle:api',
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ],
    ];

    protected function schedule(Schedule $schedule): void
    {
        Log::info('✅ schedule() method in Kernel is being called.');

        $schedule->command('data:periods')
            ->everyFifteenSeconds()
            ->evenInMaintenanceMode()
            ->withoutOverlapping()
            ->runInBackground()
            ->onOneServer()
            ->before(function () {
                \Artisan::call('data:periods');
            });


        $schedule->command('liquidity:rebuild')
            ->everyFiveMinutes()
            ->withoutOverlapping();

        $schedule->command('heatmap:rebuild')
            ->everyTenMinutes()
            ->withoutOverlapping();

        $schedule->command('news:market-fetch')
            ->hourly()
            ->evenInMaintenanceMode()
            ->withoutOverlapping()
            ->runInBackground()
            ->onOneServer()
            ->before(function () {
                \Artisan::call('news:market-fetch');
            });

        $schedule->command('news:extract-events')
            ->everyThirtyMinutes()
            ->evenInMaintenanceMode()
            ->withoutOverlapping()
            ->runInBackground()
            ->onOneServer()
            ->before(function () {
                \Artisan::call('news:extract-events');
            });

        $schedule->command('news:embed-chunks')
            ->hourly()
            ->evenInMaintenanceMode()
            ->withoutOverlapping()
            ->runInBackground()
            ->onOneServer()
            ->before(function () {
                \Artisan::call('news:embed-chunks');
            });

        $schedule->command('news:qdrant-upsert')
            ->hourly()
            ->evenInMaintenanceMode()
            ->withoutOverlapping()
            ->runInBackground()
            ->onOneServer()
            ->before(function () {
                \Artisan::call('news:qdrant-upsert');
            });
    }
}
