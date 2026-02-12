<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

class AppStart extends Command
{
    protected $signature = 'app:start';
    protected $description = 'Start all services';

    public function handle()
    {
        $this->info('🚀 Starting full dev stack...');

        $processes = [

            // Laravel server
            new Process(['php', 'artisan', 'serve', '--port=1111'], base_path()),

            // Scheduler
            new Process(['php', 'artisan', 'schedule:work'], base_path()),

            // Reverb
            new Process(['php', 'artisan', 'reverb:start'], base_path()),

            // Yahoo consumer
            new Process(['npm', 'run', 'dev'], base_path('yahoo-consumer')),

            // Frontend
            new Process(['npm', 'run', 'dev'], base_path('../frontend')),
        ];

        foreach ($processes as $process) {
            $process->start();
        }

        // giữ process sống
        while (true) {
            foreach ($processes as $process) {
                if (!$process->isRunning()) {
                    $this->error('⚠️ A process stopped!');
                }
            }
            sleep(1);
        }

        return Command::SUCCESS;
    }
}
