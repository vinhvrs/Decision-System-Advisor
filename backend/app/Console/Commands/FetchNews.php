<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FetchNews extends Command
{
    protected $signature = 'news:fetch';
    protected $description = 'Fetch latest news articles from external API and store into database';
    protected $appUrl;
    protected $appPort;

    public function __construct()
    {
        parent::__construct();
        $this->appUrl = env('APP_URL');
        $this->appPort = intval(env('APP_PORT'));
    }

    public function handle()
    {
        Log::info('[Schedule] FetchNews command started');

        // Example API call (replace with actual API endpoint and parameters)
        $response = Http::get("{$this->appUrl}:{$this->appPort}/api/news/fetch");

        if ($response->successful()) {
            $newsData = $response->json();
            $this->info('✅ News articles fetched and stored successfully.');
            Log::info('[Schedule] News articles fetched and stored successfully.');
        } else {
            $this->error('❌ Failed to fetch news articles.');
            Log::error('[Schedule] Failed to fetch news articles. Response: ' . $response->body());
        }
    }
}