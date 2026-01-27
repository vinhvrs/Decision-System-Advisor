<?php
namespace App\Console\Commands;

use DB;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Platform\Plugins\Trading\Src\Models\Knowledge;

class FetchNews extends Command
{
    protected $signature = 'news:fetch';
    protected $description = 'Fetch latest news articles from external API and store into database';
    protected $NEWSAPI_KEY;
    protected $keywords;

    public function __construct()
    {
        parent::__construct();
        $this->NEWSAPI_KEY = env('NEWSAPI_KEY');
        $this->keywords = ['stock', 'finance', 'invest', 'economy'];
    }

    public function handle()
    {
        Log::info('[Schedule] FetchNews command started');

        // Example API call (replace with actual API endpoint and parameters)
        $response = Http::get("https://eventregistry.org/api/v1/article/getArticles", [
            "action"=>"getArticles",
            "keyword" => ["Tesla Inc", "Apple Inc", "Google", "Microsoft"],
            "lang" => "eng",
            "articlesPage" => 1,
            "articlesCount" => 100,
            "articlesSortBy" => "date",
            "articlesSortByAsc" => false,
            "dataType" => [
                "news",
                "pr"
            ],
            "forceMaxDataTimeWindow" => 31,
            "resultType" => "articles",
            "apiKey" => $this->NEWSAPI_KEY
        ]);

        if ($response->successful()) {
            $news = $response->json();
            $newsData = $news['articles']['results'] ?? [];
            Log::info('[Schedule] News articles fetched and stored successfully.');

            $dataFormat = array_map(function ($article) {
                return [
                    'topic' => $article['title'] ?? null,
                    'content' => $article['body'] ?? null,
                    'author' => isset($article['source']['title'], $article['authors'][0]['name']) 
                        ? $article['source']['title'] . ", author: " . $article['authors'][0]['name'] 
                        : null,
                    'url_slug' => $article['image'] ?? $article['uri'] ?? null,
                    'published_at' => $article['dateTimePub'] ?? null,
                ];
            }, $newsData ?? []);

            try {
                foreach ($dataFormat as $data) {
                    Knowledge::updateOrCreate(
                        ['topic' => $data['topic']],
                        $data
                    );
                }
                Log::info('[Schedule] News articles inserted into database successfully.');
            } catch (\Exception $e) {
                Log::error('[Schedule] Failed to insert news articles into database. Error: ' . $e->getMessage());
            }
        } else {
            $this->error('❌ Failed to fetch news articles.');
            Log::error('[Schedule] Failed to fetch news articles. Response: ' . $response->body());
        }
    }
}