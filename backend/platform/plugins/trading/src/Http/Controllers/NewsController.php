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
        $perPage = $request->input('per_page', 15);

        // $news = $this->newsRepository->findAll($filter, $select, $perPage);
        $news = DB::table('knowledge_docs_temp')
            ->select($select ?? ['id', 'title', 'content', 'published_at', 'source', 'author'])
            ->where($filter)
            ->orderBy('published_at', 'desc')
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

    public function getBySymbol(string $symbol, int $limit = 10)
    {
        if (!$symbol){
            return response()->json(['error' => 'Symbol must required'], 404);
        }
        $newsService = new NewsService();
        $news = $newsService->getBySymbol($symbol, $limit);
        return response()->json($news);
    }
}