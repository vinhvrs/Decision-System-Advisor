<?php

namespace Platform\Plugins\Trading\Src\Services;

use App\Support\DsaTables;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class NewsService
{
    private const SYMBOL_NEWS_FRESH_DAYS = 14;

    public function __construct()
    {
        
    }

    /** @var list<string> */
    public const KNOWLEDGE_DOC_COLUMNS = [
        'id',
        'hash_key',
        'title',
        'content',
        'published_at',
        'image',
        'category',
        'symbol',
        'source',
        'author',
        'language',
        'created_at',
        'updated_at',
        'is_processed',
    ];

    /**
     * Public news index (`GET /news`) — never select full `content` (LONGTEXT) for every row (timeouts on large tables).
     * Excerpt is enough for list cards / `pickNewsThumbImage` heuristics.
     */
    public const KNOWLEDGE_DOC_INDEX_SELECT = [
        'id',
        'hash_key',
        'title',
        'published_at',
        'image',
        'category',
        'symbol',
        'source',
        'author',
        'language',
        'created_at',
        'updated_at',
        'is_processed',
    ];

    /** Fields for list/card APIs — avoids shipping full `content` (longText). */
    private const KNOWLEDGE_DOC_SYMBOL_LIST_SELECT = [
        'id',
        'hash_key',
        'title',
        'published_at',
        'image',
        'category',
        'symbol',
        'source',
        'author',
        'language',
        'created_at',
        'updated_at',
        'is_processed',
    ];

    public function getById(string $id)
    {
        return DB::table('knowledge_docs')
            ->select(self::KNOWLEDGE_DOC_COLUMNS)
            ->where('id', $id)
            ->first();
    }

    public function getBySymbol(string $symbol, int $limit)
    {
        $sym = strtoupper(trim($symbol));

        $selectCols = array_merge(self::KNOWLEDGE_DOC_SYMBOL_LIST_SELECT, [
            DB::raw('LEFT(content, 800) as content'),
        ]);

        $rows = DB::table('knowledge_docs')
            ->select($selectCols)
            ->where('symbol', $sym)
            ->orderByRaw('COALESCE(published_at, created_at) DESC')
            ->limit($limit)
            ->get();

        if ($rows->isEmpty()) {
            $rows = DB::table('knowledge_docs')
                ->select($selectCols)
                ->whereRaw('UPPER(TRIM(symbol)) = ?', [$sym])
                ->orderByRaw('COALESCE(published_at, created_at) DESC')
                ->limit($limit)
                ->get();
        }

        if ($rows->isEmpty() || $this->isStaleSymbolFeed($rows->first())) {
            $relatedRows = $this->latestRelatedRows($sym, $selectCols, $limit);
            if ($relatedRows->isNotEmpty()) {
                return $relatedRows;
            }
        }

        return $rows;
    }

    private function latestRelatedRows(string $symbol, array $selectCols, int $limit)
    {
        $terms = $this->symbolSearchTerms($symbol);
        if ($terms === []) {
            return collect();
        }

        $freshCutoff = now()->subDays(self::SYMBOL_NEWS_FRESH_DAYS);

        $rows = DB::table('knowledge_docs')
            ->select($selectCols)
            ->where(function ($q) use ($terms) {
                foreach ($terms as $term) {
                    $like = '%'.$term.'%';
                    $q->orWhere('title', 'like', $like);
                }
            })
            ->whereRaw('COALESCE(published_at, created_at) >= ?', [$freshCutoff])
            ->orderByRaw('COALESCE(published_at, created_at) DESC')
            ->limit($limit)
            ->get();

        return $rows->map(function ($row) use ($symbol) {
            $row->symbol = $symbol;
            return $row;
        });
    }

    private function symbolSearchTerms(string $symbol): array
    {
        $terms = [$symbol];
        $profile = DB::table(DsaTables::name('company_profile'))
            ->whereRaw('UPPER(TRIM(symbol)) = ?', [$symbol])
            ->first(['company_name']);

        $name = trim((string) ($profile->company_name ?? ''));
        if ($name !== '') {
            $terms[] = $name;
            $base = preg_replace('/\b(inc|incorporated|corporation|corp|company|co|ltd|limited|plc|class|common|stock)\b\.?/i', '', $name);
            $base = trim((string) preg_replace('/\s+/', ' ', (string) $base));
            if ($base !== '' && mb_strlen($base) >= 4) {
                $terms[] = $base;
            }
        }

        return array_values(array_unique(array_filter($terms, fn ($t) => trim((string) $t) !== '')));
    }

    private function isStaleSymbolFeed($row): bool
    {
        if (! $row) {
            return true;
        }

        $raw = $row->published_at ?? $row->created_at ?? null;
        if ($raw === null || $raw === '') {
            return true;
        }

        try {
            return Carbon::parse($raw)->lt(now()->subDays(self::SYMBOL_NEWS_FRESH_DAYS));
        } catch (\Throwable) {
            return true;
        }
    }

}
