<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Str;
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

        $response = Http::get("https://eventregistry.org/api/v1/article/getArticles", [
            "action" => "getArticles",
            "keyword" => ["Tesla Inc", "Apple Inc", "Google", "Microsoft"],
            "lang" => "eng",
            "articlesPage" => 1,
            "articlesCount" => 100,
            "articlesSortBy" => "date",
            "articlesSortByAsc" => false,
            "dataType" => ["news", "pr"],
            "forceMaxDataTimeWindow" => 31,
            "resultType" => "articles",
            "apiKey" => $this->NEWSAPI_KEY
        ]);

        if ($response->successful()) {
            $news = $response->json();
            $newsData = $news['articles']['results'] ?? [];

            $dataFormat = array_map(function ($article) {
                $topic = $article['title'] ?? 'No Title';
                $imageUrl = $article['image'] ?? null;
                $bodyText = $article['body'] ?? '';

                // Tạo Slug an toàn
                $slug = Str::slug($topic);

                // Escape nếu ảnh null: Chỉ chèn URL ảnh nếu biến $imageUrl thực sự có giá trị
                $combinedContent = ($imageUrl && filter_var($imageUrl, FILTER_VALIDATE_URL))
                    ? "Image URL: " . $imageUrl . "\n\n" . $bodyText
                    : $bodyText;

                return [
                    'topic' => $topic,
                    'content' => $combinedContent,
                    'author' => isset($article['source']['title'], $article['authors'][0]['name'])
                        ? $article['source']['title'] . ", author: " . $article['authors'][0]['name']
                        : ($article['source']['title'] ?? 'Unknown'),
                    'url_slug' => $slug,
                    'published_at' => $article['dateTimePub'] ?? null,
                ];
            }, $newsData);

            try {
                foreach ($dataFormat as $data) {
                    // Sử dụng updateOrCreate để tránh trùng lặp dựa trên topic
                    Knowledge::updateOrCreate(
                        ['topic' => $data['topic']],
                        $data
                    );
                }
                Log::info('[Schedule] News articles indexed successfully.');
            } catch (\Exception $e) {
                Log::error('[Schedule] Database Error: ' . $e->getMessage());
            }
        } else {
            Log::error('[Schedule] API Request Failed: ' . $response->status());
        }
    }
}