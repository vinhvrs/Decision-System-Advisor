<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Services\SimilarSignalService;

class SimilarSignalController extends Controller
{
    protected SimilarSignalService $similarSignalService;

    public function __construct(SimilarSignalService $similarSignalService)
    {
        $this->similarSignalService = $similarSignalService;
    }

    public function generateSignals(Request $request, string $symbol)
    {
        $period = $request->query('period', 'daily');
        $signals = $this->similarSignalService->generateSignal($symbol, $period);
        return response()->json(['data' => $signals]);
    }
}