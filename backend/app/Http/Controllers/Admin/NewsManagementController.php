<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NewsManagementController extends Controller
{
    public function index(Request $request)
    {
        $perPage = (int) $request->input('per_page', 15);
        $page = (int) $request->input('page', 1);
        $search = $request->input('search');
        $symbol = $request->input('symbol');

        // Omit `content` in list payload (large) — still filter by title/content when searching
        $query = DB::table('knowledge_docs_temp')
            ->select(['id', 'title', 'symbol', 'published_at', 'source', 'author', 'created_at', 'updated_at'])
            ->orderByDesc('published_at');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('content', 'like', "%{$search}%");
            });
        }
        if ($symbol) {
            $query->where('symbol', $symbol);
        }

        $news = $query->paginate($perPage, ['*'], 'page', $page);
        return response()->json($news);
    }

    public function show(string $id)
    {
        $news = DB::table('knowledge_docs_temp')->where('id', $id)->first();
        if (!$news) {
            return response()->json(['message' => 'News not found'], 404);
        }
        return response()->json($news);
    }

    public function destroy(string $id)
    {
        $deleted = DB::table('knowledge_docs_temp')->where('id', $id)->delete();
        if (!$deleted) {
            return response()->json(['message' => 'News not found'], 404);
        }
        return response()->json(['message' => 'News deleted successfully']);
    }
}
