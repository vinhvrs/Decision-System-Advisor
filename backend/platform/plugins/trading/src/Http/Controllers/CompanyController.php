<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Services\CompanyService;

class CompanyController extends Controller
{
    protected $companyService;

    public function __construct(CompanyService $companyService)
    {
        $this->companyService = $companyService;
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
}