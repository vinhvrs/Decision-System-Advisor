<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class FetchMarketNews extends Command
{
    protected $signature = 'news:market-fetch {company?} {ticker?} {--top10}';

    protected $description = 'Fetch GDELT news and store into knowledge_docs and knowledge_chunks';

    public function handle()
    {
        if ($this->option('top10')) {
            $this->fetchTop10();
            return;
        }

        $company = $this->argument('company');
        $ticker = $this->argument('ticker');

        if (!$company || !$ticker) {
            $this->error("Provide company & ticker OR use --top10");
            return;
        }

        $this->fetchCompany($company, strtoupper($ticker));
    }

    /**
     * Fetch predefined top 10 stocks
     */
    private function fetchTop10()
    {
        $stocks = [
            ['Apple', 'AAPL'],
            ['Microsoft', 'MSFT'],
            ['Nvidia', 'NVDA'],
            ['Amazon', 'AMZN'],
            ['Alphabet', 'GOOGL'],
            ['Meta', 'META'],
            ['Tesla', 'TSLA'],
            ['JPMorgan', 'JPM'],
            ['Exxon', 'XOM'],
            ['AMD', 'AMD']
        ];

        foreach ($stocks as [$company, $ticker]) {
            $this->info("Fetching {$ticker}...");
            $this->fetchCompany($company, $ticker);
            sleep(1); // tránh rate limit
        }

        $this->info("Top 10 fetch completed.");
    }

    /**
     * Core fetch logic for single company
     */
    private function fetchCompany($company, $ticker)
    {
        $startYear = 2015;
        $currentYear = now()->year;

        for ($year = $startYear; $year <= $currentYear; $year++) {

            $this->info("Fetching {$ticker} - Year {$year}");

            $startDate = Carbon::create($year, 1, 1)->format('Ymd000000');
            $endDate = Carbon::create($year, 12, 31)->format('Ymd235959');

            $query = urlencode("\"{$company}\" AND (earnings OR stock OR shares OR NASDAQ OR NYSE)");

            $url = "https://api.gdeltproject.org/api/v2/doc/doc?"
            .  "query={$query}"
            .  "sourcelang:eng"
            .  "&mode=ArtList"
            .  "&maxrecords=250"
            .  "&format=json"
            .  "&startdatetime={$startDate}"
            .  "&enddatetime={$endDate}";
            
            \Log::info("GDELT Fetch URL: {$url}");

            $response = Http::timeout(60)->get($url);

            if (!$response->ok()) {
                $this->warn("Failed {$ticker} {$year}");
                continue;
            }

            $data = $response->json();

            if (!isset($data['articles'])) {
                $this->warn("No data {$ticker} {$year}");
                continue;
            }

            foreach ($data['articles'] as $article) {

                if (empty($article['url']) || empty($article['title']) || empty($article['seendate'])) {
                    continue;
                }

                $exists = DB::table('knowledge_docs')
                    ->where('source', $article['url'])
                    ->exists();

                if ($exists)
                    continue;

                try {
                    $eventDate = Carbon::createFromFormat(
                        'Ymd\THis\Z',
                        $article['seendate'],
                        'UTC'
                    );
                } catch (\Exception $e) {
                    continue;
                }

                $docId = (string) Str::uuid();
                $content = trim($article['title']);

                DB::table('knowledge_docs')->insert([
                    'id' => $docId,
                    'title' => 'news:' . $content,
                    'content' => $content,
                    'category' => 'article',
                    'source' => $article['url'],
                    'author' => $article['domain'] ?? 'unknown',
                    'language' => $article['language'] ?? 'English',
                    'created_at' => $eventDate,
                    'updated_at' => now()
                ]);

                DB::table('knowledge_chunks')->insert([
                    'id' => (string) Str::uuid(),
                    'knowledge_id' => null,
                    'docs_id' => $docId,
                    'chunk_index' => 0,
                    'content' => $content,
                    'source' => $article['domain'] ?? 'unknown',
                    'token' => str_word_count($content),
                    'vector' => null,
                    'data' => json_encode([
                        'ticker' => $ticker,
                        'company' => $company,
                        'event_date' => $eventDate->toISOString(),
                        'source_type' => 'gdelt',
                        'event_scope' => 'company',
                        'impact_window' => [
                            'start' => $eventDate->copy()->subDay()->toDateString(),
                            'end' => $eventDate->copy()->addDay()->toDateString()
                        ],
                        'status' => 'raw_news'
                    ]),
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }

            sleep(2); // tránh rate limit
        }

        $this->info("Finished {$ticker}");
    }

}
