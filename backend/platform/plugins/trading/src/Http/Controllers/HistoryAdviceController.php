<?php

namespace Platform\Plugins\Trading\Src\Http\Controllers;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class HistoryAdviceController extends Controller
{
    /**
     * GET /instruments/history-advice?symbol=AAPL&from=2024-01-01&to=2025-12-31
     * Rows from history_advice (MySQL), oldest first. Empty if table missing.
     */
    public function index(Request $request)
    {
        $symbol = strtoupper(trim((string) $request->query('symbol', '')));
        $from = trim((string) $request->query('from', ''));
        $to = trim((string) $request->query('to', ''));

        if ($symbol === '' || $from === '' || $to === '') {
            return response()->json(['data' => []]);
        }

        if (! Schema::hasTable('history_advice')) {
            return response()->json(['data' => []]);
        }

        try {
            $fromCarbon = Carbon::parse($from)->startOfDay();
            $toCarbon = Carbon::parse($to)->endOfDay();
        } catch (\Throwable) {
            return response()->json(['data' => []]);
        }

        // Include advice dated before the window so early candles can resolve "latest on or before".
        $queryFrom = (clone $fromCarbon)->subDays(400);

        $rows = DB::table('history_advice')
            ->where('symbol', $symbol)
            ->where('as_of_ts', '<=', $toCarbon->toDateTimeString())
            ->where('as_of_ts', '>=', $queryFrom->toDateTimeString())
            ->orderBy('as_of_ts')
            ->get();

        return response()->json(['data' => $rows]);
    }
}
