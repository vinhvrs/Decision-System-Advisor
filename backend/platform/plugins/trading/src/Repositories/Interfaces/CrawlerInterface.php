<?php

namespace Platform\Plugins\Trading\Src\Repositories\Interfaces;

use Platform\Plugins\Trading\Src\Models\CrawlerState;
use Illuminate\Support\Collection;

interface CrawlerInterface
{
    /**
     * Lấy danh sách symbols để crawl theo chunk.
     * $source = tên nguồn crawl (vd: yahoo_rss, news_api, etc.)
     */
    public function getSymbolsChunk(string $source, int $chunkSize = 500, ?string $afterSymbol = null): Collection;

    /**
     * Lấy hoặc tạo crawler state theo (source, symbol).
     */
    public function getOrCreateState(string $source, string $symbol): CrawlerState;

    /**
     * Cố gắng acquire "soft lock" để tránh 2 process crawl cùng 1 symbol/source.
     * Trả về true nếu lock được.
     */
    public function acquireLock(string $source, string $symbol, int $lockSeconds = 600): bool;

    /**
     * Release lock sau khi crawl xong.
     */
    public function releaseLock(string $source, string $symbol): void;

    /**
     * Mark crawl thành công (update checkpoint).
     */
    public function markSuccess(string $source, string $symbol, ?\Carbon\Carbon $publishedAt = null, ?string $guid = null): void;

    /**
     * Mark crawl thất bại.
     */
    public function markFailure(string $source, string $symbol, string $error): void;

    /**
     * Lấy checkpoint (last_published_at, last_guid) để incremental.
     */
    public function getCheckpoint(string $source, string $symbol): array;
}