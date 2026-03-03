<?php

namespace Platform\Plugins\Trading\Src\Repositories\Eloquent;

use Platform\Plugins\Trading\Src\Repositories\Interfaces\CrawlerInterface;
use Platform\Plugins\Trading\Src\Models\CrawlerState;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CrawlerRepository implements CrawlerInterface
{
    /**
     * Lấy symbols theo chunk: ưu tiên instruments, fallback company_profile.
     * afterSymbol dùng để paging theo alphabet (A -> Z).
     */
    public function getSymbolsChunk(string $source, int $chunkSize = 500, ?string $afterSymbol = null): Collection
    {
        // instruments là nguồn chuẩn nhất vì có type/slug/exchange...
        $q = DB::table('instruments')
            ->select('symbol')
            ->whereNotNull('symbol')
            ->where('symbol', '!=', '')
            ->orderBy('symbol', 'asc');

        if ($afterSymbol) {
            $q->where('symbol', '>', strtoupper($afterSymbol));
        }

        $symbols = $q->limit($chunkSize)->pluck('symbol');

        // nếu instruments trống (hiếm), fallback company_profile
        if ($symbols->isEmpty()) {
            $q2 = DB::table('company_profile')
                ->select('symbol')
                ->whereNotNull('symbol')
                ->where('symbol', '!=', '')
                ->orderBy('symbol', 'asc');

            if ($afterSymbol) {
                $q2->where('symbol', '>', strtoupper($afterSymbol));
            }

            $symbols = $q2->limit($chunkSize)->pluck('symbol');
        }

        // normalize uppercase + unique
        return $symbols->map(fn ($s) => strtoupper(trim($s)))->filter()->unique()->values();
    }

    public function getOrCreateState(string $source, string $symbol): CrawlerState
    {
        $symbol = strtoupper(trim($symbol));

        return CrawlerState::firstOrCreate(
            ['source' => $source, 'symbol' => $symbol],
            [
                'fail_count' => 0,
                'last_error' => null,
                'last_run_at' => null,
                'locked_until' => null,
            ]
        );
    }

    /**
     * Soft lock bằng locked_until (cần cột locked_until trong migration).
     * - Nếu locked_until null hoặc đã hết hạn => set locked_until = now + lockSeconds
     * - Trả true nếu update thành công (tức lock được)
     */
    public function acquireLock(string $source, string $symbol, int $lockSeconds = 600): bool
    {
        $symbol = strtoupper(trim($symbol));
        $now = now();
        $until = $now->copy()->addSeconds($lockSeconds);

        // update có điều kiện để tránh race
        $updated = DB::table('crawler_states')
            ->where('source', $source)
            ->where('symbol', $symbol)
            ->where(function ($q) use ($now) {
                $q->whereNull('locked_until')
                  ->orWhere('locked_until', '<', $now);
            })
            ->update([
                'locked_until' => $until,
                'updated_at' => $now,
            ]);

        // Nếu state chưa tồn tại thì tạo trước rồi lock lại
        if ($updated === 0) {
            $this->getOrCreateState($source, $symbol);

            $updated = DB::table('crawler_states')
                ->where('source', $source)
                ->where('symbol', $symbol)
                ->where(function ($q) use ($now) {
                    $q->whereNull('locked_until')
                      ->orWhere('locked_until', '<', $now);
                })
                ->update([
                    'locked_until' => $until,
                    'updated_at' => $now,
                ]);
        }

        return $updated > 0;
    }

    public function releaseLock(string $source, string $symbol): void
    {
        $symbol = strtoupper(trim($symbol));

        DB::table('crawler_states')
            ->where('source', $source)
            ->where('symbol', $symbol)
            ->update([
                'locked_until' => null,
                'updated_at' => now(),
            ]);
    }

    public function markSuccess(string $source, string $symbol, ?\Carbon\Carbon $publishedAt = null, ?string $guid = null): void
    {
        $state = $this->getOrCreateState($source, $symbol);

        $state->last_published_at = $publishedAt;
        $state->last_guid = $guid;
        $state->fail_count = 0;
        $state->last_error = null;
        $state->last_run_at = now();
        $state->locked_until = null;
        $state->save();
    }

    public function markFailure(string $source, string $symbol, string $error): void
    {
        $state = $this->getOrCreateState($source, $symbol);

        $state->fail_count = (int) $state->fail_count + 1;
        $state->last_error = mb_substr($error, 0, 2000);
        $state->last_run_at = now();
        $state->locked_until = null;
        $state->save();
    }

    public function getCheckpoint(string $source, string $symbol): array
    {
        $state = $this->getOrCreateState($source, $symbol);

        return [
            'last_published_at' => $state->last_published_at,
            'last_guid'         => $state->last_guid,
            'fail_count'        => $state->fail_count,
        ];
    }
}