<?php

namespace Platform\Plugins\Trading\Src\Http\Controllers\CollectData;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\KnowledgeRepository;
use Platform\Plugins\Trading\Src\Services\NewsFetchService;
use Illuminate\Http\Request;


class GetNewsData extends Controller
{
    protected $knowledgeRepository;
    protected $newsFetchService;

    public function __construct(KnowledgeRepository $knowledgeRepository, NewsFetchService $newsFetchService)
    {
        $this->knowledgeRepository = $knowledgeRepository;
        $this->newsFetchService = $newsFetchService;
    }

    public function fetchNewsData()
    {
        $financeNews = $this->newsFetchService->fetchLatestNews('finance', 10);
        $stockNews = $this->newsFetchService->fetchLatestNews('stock market', 10);

        $newsData = array_merge($financeNews, $stockNews);
        //return response()->json($newsData);
        $this->newsFetchService->storeNewsItems($newsData, $this->knowledgeRepository);
        return response()->json(['message' => 'News data fetched and stored successfully'], 200);
    }

    public function fetchNewsByKeyword(Request $request)
    {
        $keyword = $request->input('q', 'finance');
        $maxResults = $request->input('max_results', 10);
        $newsItems = $this->newsFetchService->fetchByKeyword($keyword, $maxResults);
        $this->newsFetchService->storeNewsItems($newsItems, $this->knowledgeRepository);
        return response()->json(['message' => 'News data fetched and stored successfully'], 200);
    }

    public function getNewsBySlug($slug)
    {
        $knowledge = $this->knowledgeRepository->findBySlug($slug);
        if ($knowledge) {
            return response()->json($knowledge);
        }
        return response()->json(['error' => 'News article not found'], 404);
    }
}