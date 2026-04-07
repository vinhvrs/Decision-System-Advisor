<?php

namespace Platform\Plugins\Trading\Src\Repositories\Interfaces;

use Platform\Plugins\Trading\Src\Models\CrawlerState;
use Illuminate\Support\Collection;

interface CrawlerInterface
{
    /**
     * Symbols to crawl in one chunk.
     * $source: crawl source key (e.g. yahoo_rss, news_api).
     */
    public function getSymbolsChunk(string $source, int $chunkSize = 500, ?string $afterSymbol = null): Collection;

    /** Get or create crawler state for (source, symbol). */
    public function getOrCreateState(string $source, string $symbol): CrawlerState;

    /**
     * Try to acquire a soft lock so two workers do not crawl the same symbol/source.
     * Returns true if the lock was acquired.
     */
    public function acquireLock(string $source, string $symbol, int $lockSeconds = 600): bool;

    /**
     * Release lock sau khi crawl xong.
     */
    public function releaseLock(string $source, string $symbol): void;

    /** Mark successful crawl (update checkpoint). */
    public function markSuccess(string $source, string $symbol, ?\Carbon\Carbon $publishedAt = null, ?string $guid = null): void;

    /** Mark failed crawl. */
    public function markFailure(string $source, string $symbol, string $error): void;

    /** Checkpoint for incremental crawl (last_published_at, last_guid). */
    public function getCheckpoint(string $source, string $symbol): array;
}