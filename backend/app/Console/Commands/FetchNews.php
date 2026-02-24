<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class FetchNews extends Command
{
    protected $signature = 'news:fetch';
    protected $description = 'Fetch latest news for top 500 stocks and store into knowledge_docs';

    protected $NEWSAPI_KEY;

    public function __construct()
    {
        parent::__construct();
        $this->NEWSAPI_KEY = env('NEWSAPI_KEY');
    }

    public function handle()
    {
        Log::info('[Schedule] FetchNews started');

        if (!$this->NEWSAPI_KEY) {
            Log::error('[Schedule] NEWSAPI_KEY missing');
            return;
        }

        DB::table('company_profile')
            ->select('symbol', 'company_name')
            ->orderByDesc('market_cap')
            ->limit(500)
            ->chunk(25, function ($batch) {

                $keywords = $batch->map(function ($item) {
                    return $item->name ?? $item->symbol;
                })->toArray();

                $this->fetchBatch($batch, $keywords);

                sleep(2);
            });

        Log::info('[Schedule] FetchNews completed');
    }

    private function fetchBatch($batch, array $keywords)
    {
        $response = Http::get("https://eventregistry.org/api/v1/article/getArticles", [
            "action" => "getArticles",
            "keyword" => $keywords,
            "lang" => "eng",
            "articlesPage" => 1,
            "articlesCount" => 100,
            "articlesSortBy" => "date",
            "articlesSortByAsc" => false,
            "dataType" => ["news", "pr"],
            "forceMaxDataTimeWindow" => 7,
            "resultType" => "articles",
            "apiKey" => $this->NEWSAPI_KEY
        ]);

        if (!$response->successful()) {
            Log::error('[Schedule] API Failed: ' . $response->status());
            return;
        }

        $news = $response->json();
        $newsData = $news['articles']['results'] ?? [];

        foreach ($newsData as $article) {

            if (empty($article['title']) || empty($article['url'])) {
                continue;
            }

            // tránh duplicate theo URL
            $exists = DB::table('knowledge_docs')
                ->where('source', $article['url'])
                ->exists();

            if ($exists) continue;

            $title = $article['title'];
            $content = $article['body'] ?? $title;

            try {
                $publishedAt = isset($article['dateTimePub'])
                    ? Carbon::parse($article['dateTimePub'])
                    : now();
            } catch (\Exception $e) {
                $publishedAt = now();
            }

            DB::table('knowledge_docs')->insert([
                'id'        => (string) Str::uuid(),
                'title'     => $title,
                'content'   => $content,
                'category'  => 'article',
                'source'    => $article['url'],
                'author'    => $article['source']['title'] ?? 'Unknown',
                'language'  => 'en',
                'created_at'=> $publishedAt,
                'updated_at'=> now(),
            ]);
        }

        Log::info('[Schedule] Batch processed: ' . implode(',', $keywords));
    }
}
