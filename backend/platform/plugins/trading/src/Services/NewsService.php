<?php

namespace Platform\Plugins\Trading\Src\Services;

use Illuminate\Support\Facades\DB;

class NewsService
{
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

        return $rows;
    }

}
