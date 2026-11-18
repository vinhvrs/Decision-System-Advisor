<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/** Public application façade; Python owns calculations and source ingestion. */
class DataMetricsController extends Controller
{
    public function show(Request $request, string $path = '')
    {
        $allowed = ['data-health', 'universe', 'macro/dashboard', 'correlation', 'crypto-context'];
        if (!in_array($path, $allowed, true) && !preg_match('~^(metrics|sourced-fundamentals|positioning)/[A-Za-z0-9^=.-]{1,16}$~', $path)) {
            return response()->json(['message' => 'Unknown data endpoint'], 404);
        }
        try {
            $url = rtrim(config('services.python_engine.url'), '/');
            $response = Http::acceptJson()->connectTimeout(3)->timeout(15)->get($url.'/api/v1/'.$path,
                $request->only(['timeframe', 'symbols', 'window', 'symbol']));
            if ($response->status() >= 500) return response()->json(['message' => 'Data engine temporarily unavailable', 'quality' => 'SOURCE_ERROR'], 503);
            return response()->json($response->json(), $response->status())->header('Cache-Control', 'no-store');
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Data engine temporarily unavailable', 'quality' => 'SOURCE_ERROR'], 503);
        }
    }
}
