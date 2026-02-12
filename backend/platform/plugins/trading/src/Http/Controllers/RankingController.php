<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Services\SnapshotService;

class RankingController extends Controller
{
    protected SnapshotService $snapshotService;

    public function __construct(SnapshotService $snapshotService)
    {
        $this->snapshotService = $snapshotService;
    }

    public function topLiquidity(Request $request)
    {   
        $limit = $request->get('limit', 100);

        return response()->json([
            'data' => $this->snapshotService->topLiquidity($limit),
        ]);
    }

    public function topGainers(Request $request)
    {
        $limit = $request->get('limit', 100);

        return response()->json([
            'data' => $this->snapshotService->topGainers($limit),
        ]);
    }

    public function topLosers(Request $request)
    {
        $limit = $request->get('limit', 100);

        return response()->json([
            'data' => $this->snapshotService->topLosers($limit),
        ]);
    }
}
