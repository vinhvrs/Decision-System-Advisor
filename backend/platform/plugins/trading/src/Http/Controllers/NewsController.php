<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\NewsRepository;
use Platform\Plugins\Trading\Src\Services\NewsService;


class NewsController extends Controller
{
    protected $newsRepository;
    protected $newsService;

    public function __construct(NewsRepository $newsRepository)
    {
        $this->newsRepository = $newsRepository;
        $this->newsService = new NewsService();
    }

    public function index(Request $request)
    {
        $filter = $request->input('filter', []);
        $select = $request->input('select');
        $perPage = (int) $request->input('per_page', 15);
        $perPage = max(1, min(100, $perPage));

        $columns = is_array($select) && $select !== []
            ? $select
            : NewsService::KNOWLEDGE_DOC_COLUMNS;

        $query = DB::table('knowledge_docs')->select($columns);

        if (is_array($filter) && $filter !== []) {
            $query->where($filter);
        }

        $news = $query
            ->orderByRaw('COALESCE(published_at, created_at) DESC')
            ->paginate($perPage);

        return response()->json($news);
    }

    public function show(string $id)
    {
        $news = $this->newsService->getById($id);
        if ($news) {
            return response()->json($news);
        }
        return response()->json(['error' => 'News not found'], 404);
    }

    public function store(Request $request)
    {
        $data = $request->only(['title', 'content', 'tags']);
        $news = $this->newsRepository->create($data);
        return response()->json($news, 201);
    }
    public function destroy(string $id)
    {
        $deleted = $this->newsRepository->delete($id);
        if ($deleted) {
            return response()->json(['message' => 'News deleted successfully']);
        }
        return response()->json(['error' => 'News not found'], 404);
    }

    public function getBySymbol(Request $request, string $symbol)
    {
        $symbol = trim($symbol);
        if ($symbol === '') {
            return response()->json(['error' => 'Symbol is required'], 404);
        }

        $limit = (int) $request->query('limit', 20);
        $limit = max(1, min(50, $limit));

        $news = $this->newsService->getBySymbol($symbol, $limit);

        return response()->json($news);
    }
}