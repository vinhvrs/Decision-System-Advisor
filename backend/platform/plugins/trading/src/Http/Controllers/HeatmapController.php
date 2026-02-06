<?php

namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Services\HeatmapService;

class HeatmapController extends Controller
{
    public function daily(Request $request): JsonResponse
    {
        $limit = (int) $request->get('limit', 100);

        return response()->json([
            'data' => app(HeatmapService::class)->daily($limit),
        ]);
    }
}
