<?php

namespace App\Http\Controllers;

use App\Services\IndicatorConfigService;

/** Public read-only resolved indicator tunables (Laravel API + Python engine). */
class IndicatorConfigController extends Controller
{
    public function show(IndicatorConfigService $indicatorConfig)
    {
        $all = $indicatorConfig->all();
        $meta = $all['_meta'] ?? ['source' => 'env', 'active_parameters' => 0];
        unset($all['_meta']);

        return response()->json([
            'data' => $all,
            'meta' => $meta,
        ]);
    }
}
