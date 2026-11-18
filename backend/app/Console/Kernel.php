<?php
namespace App\Console;
use App\Console\Commands\ElasticReindexCommand;
use App\Console\Commands\ElasticSetupCommand;
use App\Console\Commands\DataPeriods;
use App\Console\Commands\DataCoverage;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use Illuminate\Support\Facades\Log;

class Kernel extends ConsoleKernel
{
    protected $commands = [
        ElasticSetupCommand::class,
        ElasticReindexCommand::class,
        DataPeriods::class,
        DataCoverage::class,
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

        // Canonical OHLC persistence runs in python_engine stock_job (DSATurbo).
        // Do not schedule data:periods here: it uses a different Yahoo/timestamp
        // convention and can create duplicate daily bars alongside DSATurbo.
        // data:periods remains registered for explicit legacy/manual diagnostics only.

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
