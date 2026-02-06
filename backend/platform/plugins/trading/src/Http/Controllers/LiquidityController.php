<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Services\LiquidityService;

class LiquidityController extends Controller
{
    public function top(Request $request)
    {
        $limit = $request->get('limit', 100);

        return response()->json([
            'data' => app(LiquidityService::class)->topDaily($limit),
        ]);
    }
}
