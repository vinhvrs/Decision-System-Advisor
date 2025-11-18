<?php
namespace App\Console;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use App\Console\Commands\FetchStockAttributes;
use App\Console\Commands\DataPeriods;
use Illuminate\Support\Facades\Log;


class Kernel extends ConsoleKernel
{
    protected $commands = [
        FetchStockAttributes::class,
        DataPeriods::class,
    ];
    protected function schedule(Schedule $schedule): void
    {
        Log::info('✅ schedule() method in Kernel is being called.');

        $schedule->command('stocks:fetch')
            ->everyMinute()
            ->evenInMaintenanceMode()
            ->withoutOverlapping()
            ->runInBackground();

        $schedule->command('data:periods')
            ->everyFifteenSeconds()
            ->evenInMaintenanceMode()
            ->withoutOverlapping()
            ->runInBackground();
    }
}
