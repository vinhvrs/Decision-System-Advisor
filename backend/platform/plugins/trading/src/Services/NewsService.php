<?php

namespace Platform\Plugins\Trading\Src\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class NewsService
{
    public function __construct()
    {
        
    }

    public function getById(string $id)
    {
        $news = DB::table('knowledge_docs_temp')
            ->select('id', 'title', 'content', 'published_at', 'source', 'author')
            ->where('id', $id)
            ->first();
        return $news;
    }

    public function getBySymbol(string $symbol, int $limit)
    {
        $news = DB::table('knowledge_docs_temp')
            ->select('id', 'title', 'content', 'published_at', 'source', 'author')
            ->where('symbol', $symbol)
            ->orderBy('published_at', 'desc')
            ->limit($limit)
            ->get();
        return $news;
    }

}
