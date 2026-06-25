<?php

namespace Platform\Plugins\Trading\Src\Http\Controllers\CollectData;

use App\Support\DsaTables;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;
use Platform\Plugins\Trading\Src\Models\Instruments;
use Platform\Plugins\Trading\Src\Services\PriceFetchService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Platform\Plugins\Trading\Src\Services\HistoryFetchService;

class GetInstrumentData extends Controller
{
    public function fetch($periodId, PriceFetchService $service)
    {
        set_time_limit(0);
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
        DB::table(DsaTables::name('instrument_data'))->upsert(
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

        // Daily → Weekly → Monthly -> Yearly
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

    public function allInstruments(HistoryFetchService $service)
{
    ini_set('memory_limit', '1024M');
    set_time_limit(0);

    $instruments = Instruments::all()->select('id')->pluck('id')->toArray();

    // $instruments = [
    //     '928e387c-88f4-4fb1-9af1-a9bbfa872532',
    //     'd094f426-1e91-4f3f-8ca0-e043a3a5d5e5',
    //     '9967ffeb-350e-4a3c-a3ee-877dd006e85d',
    //     'ab515a5e-6485-4003-92df-bc98e5ee8253',
    //     '09c253be-f3e1-4a21-8156-13d7fe490c2b'
    //     ];
    $totalCount = 0;

    foreach ($instruments as $instrument) {
        try {
            $count = $service->importInstrument($instrument);
            $totalCount += $count;
        } catch (\Throwable $e) {
            Log::error("Import failed for {$instrument}: " . $e->getMessage());
        }
    }

    return response()->json([
        'message' => 'Full history imported for all instruments',
        'total_inserted' => $totalCount
    ]);
}


}
