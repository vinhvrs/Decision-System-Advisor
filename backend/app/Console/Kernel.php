<?php
namespace App\Console;
use App\Console\Commands\ElasticReindexCommand;
use App\Console\Commands\ElasticSetupCommand;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use Illuminate\Support\Facades\Log;

class Kernel extends ConsoleKernel
{
    protected $commands = [
        ElasticSetupCommand::class,
        ElasticReindexCommand::class,
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
        Log::info('schedule() invoked in Console Kernel.');

        // Historical OHLC persistence is separate from realtime quotes.
        // Running the Yahoo daily-history job every 15 seconds can throttle later
        // symbols in the universe and leave them realtime-only.
        $schedule->command('data:periods')
            ->everyFifteenMinutes()
            ->evenInMaintenanceMode()
            ->withoutOverlapping()
            ->runInBackground()
            ->onOneServer();

        $schedule->command('liquidity:rebuild')
            ->everyFiveMinutes()
            ->withoutOverlapping();

        $schedule->command('heatmap:rebuild')
            ->everyTenMinutes()
            ->withoutOverlapping();

        // News ingest + embed + Qdrant are handled by the Python data-engine (FastAPI lifespan / APScheduler).
        // Do not schedule news:* Artisan commands here — they duplicate work and conflict with python_engine.
        // Manual one-offs if ever needed: php artisan news:market-fetch …, news:embed-chunks, etc.
    }
}
