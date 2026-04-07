<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Platform\Plugins\Trading\Src\Services\CompanyService;
use Platform\Plugins\Trading\Src\Services\NewsService;

class CompanyController extends Controller
{
    public function __construct(
        protected CompanyService $companyService,
        protected NewsService $newsService,
    ) {}

    public function index(Request $request)
    {
        $select = $request->input('select', ['*']);
        $filter = $request->input('filter', []);
        $perPage = (int) $request->input('per_page', 15);
        $page = (int) $request->input('page', 1);

        $companies = $this->companyService->index($select, $filter, $perPage, $page);
        return response()->json($companies);
    }

    public function getProfileBySymbol(Request $request, string $symbol)
    {
        $company = $this->companyService->getProfileBySymbol($symbol);
        return response()->json($company);
    }

    public function getSimilarCompanies(Request $request, string $symbol)
    {
        $limit = (int) $request->input('limit', 5);
        $companies = $this->companyService->getSimilar($symbol, $limit);
        return response()->json($companies);
    }

    /**
     * One round-trip for company profile UI: profile + news + similar peers.
     */
    public function getOverview(Request $request, string $symbol)
    {
        $sym = strtoupper(trim($symbol));
        if ($sym === '') {
            return response()->json(['error' => 'Symbol is required'], 404);
        }

        $newsLimit = max(1, min(50, (int) $request->query('news_limit', 25)));
        $similarLimit = max(1, min(20, (int) $request->query('similar_limit', 6)));

        $profile = $this->companyService->getProfileBySymbol($sym);
        $news = $this->newsService->getBySymbol($sym, $newsLimit);
        $sector = $profile?->sector ?? null;
        $similar = $this->companyService->similarInSector($sector, $sym, $similarLimit);

        return response()->json([
            'profile' => $profile,
            'news' => $news,
            'similar' => $similar,
        ]);
    }
}