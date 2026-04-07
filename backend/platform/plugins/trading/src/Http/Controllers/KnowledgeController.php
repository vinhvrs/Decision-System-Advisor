<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\KnowledgeRepository;
use Platform\Plugins\Trading\Src\Models\Knowledge;
use Platform\Plugins\Trading\Src\Services\NewsService;


class KnowledgeController extends Controller
{
    protected $knowledgeRepository;
    protected $newsService;

    public function __construct(KnowledgeRepository $knowledgeRepository)
    {
        $this->knowledgeRepository = $knowledgeRepository;
        $this->newsService = new NewsService();
    }

    public function index(Request $request)
    {
        $filter = $request->input('filter', []);
        $select = $request->input('select', ['*']);
        $perPage = $request->input('per_page', 15);

        $knowledges = DB::table('knowledge_docs')
            ->select('id', 'title', 'content', 'published_at', 'source', 'author')
            ->orderBy('published_at', 'desc')
            ->paginate($perPage);

        return response()->json($knowledges);
    }

    public function show(string $id)
    {
        $knowledge = $this->newsService->getById($id);
        if ($knowledge) {
            return response()->json($knowledge);
        }
        return response()->json(['error' => 'News not found'], 404);
    }

    public function store(Request $request)
    {
        $data = $request->only(['title', 'content', 'tags']);
        $knowledge = $this->knowledgeRepository->create($data);
        return response()->json($knowledge, 201);
    }

    public function update(Request $request, string $id)
    {
        $data = $request->only(['title', 'content', 'tags']);
        $knowledge = $this->knowledgeRepository->update($id, $data);
        if ($knowledge) {
            return response()->json($knowledge);
        }
        return response()->json(['error' => 'Knowledge not found'], 404);
    }

    public function destroy(string $id)
    {
        $deleted = $this->knowledgeRepository->delete($id);
        if ($deleted) {
            return response()->json(['message' => 'Knowledge deleted successfully']);
        }
        return response()->json(['error' => 'Knowledge not found'], 404);
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