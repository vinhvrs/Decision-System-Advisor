<?php

namespace Platform\Plugins\Trading\Src\Http\Controllers;

use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;
use Platform\Plugins\Trading\Src\Services\PriceFetchService;
use Platform\Plugins\Trading\Src\Models\InstrumentData;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Platform\Plugins\Trading\Src\Services\HistoryFetchService;

class FetchDataController extends Controller
{
    public function fetch($periodId, PriceFetchService $service)
    {
        $period = InstrumentPeriods::find($periodId);
        if (!$period) {
            return response()->json(['error' => 'Period not found'], 404);
        }

        $symbol = strtoupper($period->prefix);

        /** TRY FALLBACK */
        $result = $service->fetchFallback($symbol, $period->period);
        Log::info("Fetch result source: " . ($result['source'] ?? 'none'));

        if ($result === false) {
            return response()->json(['error' => 'All data providers failed'], 500);
        }

        $source = $result['source'];
        $data   = $result['data'];

        $bulk = [];

        foreach ($data as $row) {
            $bulk[] = [
                'id'                    => Str::uuid(),
                'instrument_period_id'  => $period->id,
                'timestamps'            => $row['timestamps'],
                'open'                  => $row['open'],
                'high'                  => $row['high'],
                'low'                   => $row['low'],
                'close'                 => $row['close'],
                'volume'                => $row['volume'],
                'source'                => $source,
                'slug'                  => $period->prefix . '-' . $row['timestamps'],
                'created_at'            => now(),
                'updated_at'            => now(),
            ];
        }

        // INSERT WITHOUT DUPLICATE
        DB::table('instrument_data')->upsert(
            $bulk,
            ['instrument_period_id', 'timestamps'], // unique
            ['open','high','low','close','volume','source','slug','updated_at']
        );

        return response()->json([
            'message' => "Data fetched successfully from $source",
            'inserted' => count($bulk),
        ]);
    }

    public function importData($instrumentId, HistoryFetchService $service)
    {
        set_time_limit(0);
        $periods = InstrumentPeriods::where('instrument_id', $instrumentId)->get();

        if ($periods->isEmpty())
            return response()->json(['error' => 'No periods found']);

        $symbol = $periods[0]->prefix;

        $full = $service->fetchFullHistory($symbol);
        if (!$full)
            return response()->json(['error' => 'Fetch failed']);

        // Daily → Weekly → Monthly
        $sets = $service->aggregatePeriods($full);

        // Map period to id
        $periodIds = [];
        foreach ($periods as $p)
            $periodIds[$p->period] = $p->id;

        $count = $service->storeHistory($symbol, $sets, $periodIds);

        return response()->json([
            'message' => 'Full history imported',
            'symbol' => $symbol,
            'rows' => $count
        ]);
    }


}
