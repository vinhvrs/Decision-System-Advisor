<?php

namespace Platform\Plugins\Trading\Src\Services;

use Platform\Plugins\Trading\Src\Repositories\Eloquent\CrawlerRepository;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class NewsCrawlerService
{
    public function __construct(
        protected CrawlerRepository $crawler,
    ) {}

    /**
     * Crawl 1 batch symbols (chunk) theo alphabet paging.
     * Trả về: [processed, inserted, skipped, failed, lastSymbol]
     */
    public function crawlBatch(string $sourceKey, int $chunkSize = 500, ?string $afterSymbol = null): array
    {
        $symbols = $this->crawler->getSymbolsChunk($sourceKey, $chunkSize, $afterSymbol);

        $processed = 0;
        $inserted  = 0;
        $skipped   = 0;
        $failed    = 0;

        foreach ($symbols as $symbol) {
            $processed++;

            // lock để tránh 2 process crawl cùng lúc
            if (!$this->crawler->acquireLock($sourceKey, $symbol, 600)) {
                $skipped++;
                continue;
            }

            try {
                $checkpoint = $this->crawler->getCheckpoint($sourceKey, $symbol);

                // TODO: thay bằng crawler thật (RSS/API)
                $articles = $this->fetchArticlesDummy($symbol, $checkpoint);

                $countInsertedForSymbol = $this->saveArticlesToKnowledgeDocs($articles);

                // Update checkpoint: tuỳ bạn dùng last_published_at / last_guid
                $latest = $this->pickLatestCheckpoint($articles);

                $this->crawler->markSuccess(
                    $sourceKey,
                    $symbol,
                    $latest['published_at'] ?? null,
                    $latest['guid'] ?? null
                );

                $inserted += $countInsertedForSymbol;

            } catch (\Throwable $e) {
                $failed++;
                $this->crawler->markFailure($sourceKey, $symbol, $e->getMessage());
                Log::error('[NewsCrawler] Failed', [
                    'source' => $sourceKey,
                    'symbol' => $symbol,
                    'err'    => $e->getMessage(),
                ]);
            } finally {
                // release lock (markSuccess/markFailure đã set locked_until=null rồi, nhưng để chắc)
                $this->crawler->releaseLock($sourceKey, $symbol);
            }
        }

        $lastSymbol = $symbols->last();

        return compact('processed', 'inserted', 'skipped', 'failed', 'lastSymbol');
    }

    /**
     * Lưu articles vào knowledge_docs, chống trùng bằng source=url.
     * KHÔNG thêm attribute cho knowledge_docs.
     *
     * Article format tối thiểu:
     * [
     *  'title' => string,
     *  'content' => string,
     *  'source' => string(url unique),
     *  'author' => string|null,
     *  'language' => 'en'|'vi'|...
     *  'published_at' => Carbon|null,
     * ]
     */
    protected function saveArticlesToKnowledgeDocs(array $articles): int
    {
        if (empty($articles)) return 0;

        $now = now();
        $rows = [];

        foreach ($articles as $a) {
            if (empty($a['source'])) continue;

            $rows[] = [
                'id'         => (string) \Illuminate\Support\Str::uuid(),
                'title'      => mb_substr($a['title'] ?? '', 0, 500),
                'content'    => $a['content'] ?? '',
                'category'   => 'article',
                'source'     => mb_substr($a['source'], 0, 500), // url unique
                'author'     => mb_substr($a['author'] ?? '', 0, 500),
                'language'   => mb_substr($a['language'] ?? 'en', 0, 50),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if (!$rows) return 0;

        /**
         * CÁCH 1 (khuyến nghị): insertOrIgnore + unique index on source
         * - nhanh
         * - tự bỏ qua bản ghi trùng source
         */
        return DB::table('knowledge_docs')->insertOrIgnore($rows);
    }

    /**
     * Dummy fetch - bạn thay bằng RSS/API thật.
     */
    protected function fetchArticlesDummy(string $symbol, array $checkpoint): array
    {
        // Ví dụ checkpoint dùng last_published_at để incremental
        $lastTs = $checkpoint['last_published_at'] ?? null;

        // TODO: thay bằng fetch RSS/API theo $symbol
        // return list articles mới hơn $lastTs

        return [
            [
                'title'        => "Dummy news for {$symbol}",
                'content'      => "This is dummy content for {$symbol}. Replace by real crawler.",
                'source'       => "https://example.com/news/{$symbol}/" . uniqid(),
                'author'       => "system",
                'language'     => "en",
                'published_at' => Carbon::now(),
                'guid'         => null,
            ]
        ];
    }

    protected function pickLatestCheckpoint(array $articles): array
    {
        $latest = null;

        foreach ($articles as $a) {
            $ts = $a['published_at'] ?? null;
            if (!$ts) continue;
            $ts = $ts instanceof Carbon ? $ts : Carbon::parse($ts);

            if (!$latest || $ts->gt($latest['published_at'])) {
                $latest = [
                    'published_at' => $ts,
                    'guid'         => $a['guid'] ?? null,
                ];
            }
        }

        return $latest ?? [];
    }
}