<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class DailyMarketHistoryController extends Controller
{
    public function __invoke(Request $request, string $symbol): JsonResponse
    {
        $query = $request->validate([
            'from' => 'required|date_format:Y-m-d',
            'to' => 'required|date_format:Y-m-d|after_or_equal:from',
        ]);
        $settings = config('dsa.market_sources', []);
        $enabled = filter_var($settings['yahoo_enabled'] ?? true, FILTER_VALIDATE_BOOL);
        $demo = filter_var($settings['public_demo'] ?? false, FILTER_VALIDATE_BOOL);
        $local = in_array(strtolower(app()->environment()), ['local', 'dev', 'development', 'testing'], true);
        $allowDemo = filter_var($settings['yahoo_public_demo'] ?? false, FILTER_VALIDATE_BOOL);
        if (!$enabled || !($demo ? $allowDemo : $local)) {
            return response()->json(['data' => [], 'quality' => 'LICENSE_RESTRICTED']);
        }
        $floor = (new \DateTimeImmutable($query['to']))->modify('-1950 days')->format('Y-m-d');
        $rows = DB::table('market_analytics_daily_bars')
            ->where('symbol', strtoupper($symbol))->where('source', 'YFINANCE_DEV')->whereNotNull('open')
            ->whereBetween('timestamps', [max($query['from'], $floor), $query['to']])
            ->orderBy('timestamps')->get(['timestamps', 'open', 'high', 'low', 'close', 'volume'])
            ->map(static fn ($row) => [
                'timestamps' => $row->timestamps,
                'open' => (float) $row->open, 'high' => (float) $row->high,
                'low' => (float) $row->low, 'close' => (float) $row->close,
                'volume' => $row->volume === null ? null : (int) $row->volume,
            ]);
        return response()->json([
            'data' => $rows, 'source' => 'Yahoo Finance', 'basis' => 'Adjusted daily OHLC',
            'quality' => $rows->isEmpty() ? 'NOT_INGESTED' : 'FALLBACK',
        ]);
    }
}
