<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class FetchNewsBackfill extends Command
{
    protected $signature = 'news:backfill {--maxCalls=1000}';
    protected $description = 'Backfill historical news from current year backward';

    protected $NEWSAPI_KEY;
    protected $apiCalls = 0;

    public function __construct()
    {
        parent::__construct();
        $this->NEWSAPI_KEY = env('NEWSAPI_KEY');
    }

    public function handle()
    {
        if (!$this->NEWSAPI_KEY) {
            $this->error("NEWSAPI_KEY missing");
            return;
        }

        $maxCalls = (int) $this->option('maxCalls');

        $stocks = DB::table('company_profile')
            ->orderByDesc('market_cap')
            ->limit(20)
            ->pluck('symbol');

        $currentYear = now()->year;

        foreach ($stocks as $symbol) {
            if ($symbol === 'META') continue;
            $this->info("Backfill {$symbol}");

            for ($year = $currentYear; $year >= 2000; $year--) {

                foreach ([1,4,7,10] as $month) { // Quarterly

                    if ($this->apiCalls >= $maxCalls) {
                        $this->warn("Max API calls reached.");
                        return;
                    }

                    $start = Carbon::create($year, $month, 1);
                    $end = (clone $start)->addMonths(3)->subDay();

                    $this->fetchWindow($symbol, $start, $end);

                    $this->apiCalls++;

                    sleep(1);
                }
            }
        }

        $this->info("Backfill completed.");
    }

    private function fetchWindow($symbol, $start, $end)
    {
        $response = Http::get("https://eventregistry.org/api/v1/article/getArticles", [
            "action" => "getArticles",
            "keyword" => [$symbol],
            "lang" => "eng",
            "dateStart" => $start->toDateString(),
            "dateEnd" => $end->toDateString(),
            "articlesPage" => 1,
            "articlesCount" => 100,
            "resultType" => "articles",
            "apiKey" => $this->NEWSAPI_KEY
        ]);

        if (!$response->successful()) {
            return;
        }

        $news = $response->json();
        $articles = $news['articles']['results'] ?? [];

        foreach ($articles as $article) {

            if (empty($article['title']) || empty($article['url'])) {
                continue;
            }

            $exists = DB::table('knowledge_docs')
                ->where('source', $article['url'])
                ->exists();

            if ($exists) continue;

            try {
                $publishedAt = Carbon::parse($article['dateTimePub']);
            } catch (\Exception $e) {
                $publishedAt = now();
            }

            DB::table('knowledge_docs')->insert([
                'id'        => (string) Str::uuid(),
                'title'     => $article['title'],
                'content'   => $article['body'] ?? $article['title'],
                'category'  => 'article',
                'source'    => $article['url'],
                'author'    => $article['source']['title'] ?? 'Unknown',
                'language'  => 'en',
                'created_at'=> $publishedAt,
                'updated_at'=> now(),
            ]);
        }
    }
}
