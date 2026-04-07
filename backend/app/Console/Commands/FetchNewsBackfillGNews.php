<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class FetchNewsBackfillGNews extends Command
{
    protected $signature = 'news:backfill-gnews {--maxCalls=100} {--emptyLimit=4}';
    protected $description = 'Backfill news from GNews. Auto-skip symbol if consecutive empty windows reached.';

    protected ?string $GNEWS_KEY = null;
    protected int $apiCalls = 0;

    public function __construct()
    {
        parent::__construct();
        $this->GNEWS_KEY = env('GNEWS_API_KEY');
    }

    public function handle()
    {
        if (!$this->GNEWS_KEY) {
            $this->error("GNEWS_KEY missing in .env");
            return Command::FAILURE;
        }

        $maxCalls    = (int) $this->option('maxCalls');
        $emptyLimit  = max(1, (int) $this->option('emptyLimit')); // consecutive empty windows
        $currentYear = now()->year;

        $stocks = DB::table('company_profile')
            ->orderByDesc('market_cap')
            ->limit(20)
            ->pluck('symbol');

        foreach ($stocks as $symbol) {

            $this->info("Backfill {$symbol}");
            $emptyCount = 0;

            for ($year = $currentYear; $year >= 2000; $year--) {

                foreach ([1, 4, 7, 10] as $month) { // Quarterly

                    if ($this->apiCalls >= $maxCalls) {
                        $this->warn("Max API calls reached.");
                        return Command::SUCCESS;
                    }

                    $start = Carbon::create($year, $month, 1);
                    $end   = (clone $start)->addMonths(3)->subDay();

                    $inserted = $this->fetchWindow($symbol, $start, $end);
                    $this->apiCalls++;

                    if ($inserted === 0) {
                        $emptyCount++;
                    } else {
                        $emptyCount = 0;
                    }

                    // After N consecutive empty quarters, move to the next symbol
                    if ($emptyCount >= $emptyLimit) {
                        $this->warn("No data for {$symbol} in {$emptyCount} consecutive windows. Switching symbol...");
                        break 2; // break both month loop + year loop
                    }

                    sleep(1); // respect rate limit
                }
            }
        }

        $this->info("Backfill completed.");
        return Command::SUCCESS;
    }

    /**
     * Fetch one time window from GNews and insert into knowledge_docs.
     * Returns number of inserted rows.
     */
    private function fetchWindow(string $symbol, Carbon $start, Carbon $end): int
    {
        try {
            $response = Http::timeout(20)->get("https://gnews.io/api/v4/search", [
                "q"      => $symbol,
                "lang"   => "en",
                // GNews expects ISO8601 (UTC works best). Carbon will format with timezone if set.
                "from"   => $start->toIso8601String(),
                "to"     => $end->toIso8601String(),
                "max"    => 100,
                "apikey" => $this->GNEWS_KEY,
            ]);
        } catch (\Throwable $e) {
            $this->warn("GNews exception for {$symbol} {$start->toDateString()} - {$end->toDateString()} : {$e->getMessage()}");
            $this->info("Inserted 0 articles for {$symbol}");
            return 0;
        }

        if (!$response->successful()) {
            $this->warn("GNews HTTP {$response->status()} for {$symbol} {$start->toDateString()} - {$end->toDateString()}");
            $this->info("Inserted 0 articles for {$symbol}");
            return 0;
        }

        $data = $response->json();
        $articles = $data['articles'] ?? [];

        $count = 0;

        foreach ($articles as $article) {

            $title = $article['title'] ?? null;
            $url   = $article['url'] ?? null;

            if (empty($title) || empty($url)) {
                continue;
            }

            // de-dup by URL
            $exists = DB::table('knowledge_docs')
                ->where('source', $url)
                ->exists();

            if ($exists) continue;

            // publishedAt
            try {
                $publishedAt = !empty($article['publishedAt'])
                    ? Carbon::parse($article['publishedAt'])
                    : now();
            } catch (\Throwable $e) {
                $publishedAt = now();
            }

            $content = $article['content']
                ?? $article['description']
                ?? $title;

            $author = $article['source']['name'] ?? 'Unknown';

            DB::table('knowledge_docs')->insert([
                'id'         => (string) Str::uuid(),
                'title'      => $title,
                'content'    => $content,
                'category'   => 'article',
                'source'     => $url,
                'author'     => $author,
                'language'   => 'en',
                'created_at' => $publishedAt,
                'updated_at' => now(),
            ]);

            $count++;
        }

        $this->info("Inserted {$count} articles for {$symbol}");
        return $count;
    }
}