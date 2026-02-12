<?php
namespace Platform\Plugins\Trading\Src\Services;
use Illuminate\Support\Facades\DB;
use Platform\Plugins\Trading\Src\Models\Instruments;
class SnapshotService
{
    public function updateFromDailyCandle($instrumentId)
    {
        $row = DB::table('instrument_data as d')
            ->join('instrument_periods as p','p.id','=','d.instrument_period_id')
            ->where('p.period','daily')
            ->where('p.instrument_id',$instrumentId)
            ->orderByDesc('d.timestamps')
            ->limit(1)
            ->select(
                'd.open',
                'd.close',
                'd.volume',
                'p.instrument_id'
            )
            ->first();

        if(!$row || $row->open <= 0) return;

        $change = (($row->close - $row->open)/$row->open)*100;

        DB::table('instrument_snapshot')->updateOrInsert(
            ['instrument_id'=>$instrumentId],
            [
                'symbol' => Instruments::find($instrumentId)->symbol,
                'price' => $row->close,
                'open' => $row->open,
                'volume' => $row->volume,
                'change_pct' => round($change,2),
                'liquidity' => $row->close * $row->volume,
                'updated_at'=>now()
            ]
        );
    }

    public function topLiquidity(int $limit = 100)
    {
        return DB::table('instrument_snapshot')
            ->orderByDesc('liquidity')
            ->limit($limit)
            ->get();
    }

    public function topGainers(int $limit = 100)
    {
        return DB::table('instrument_snapshot')
            ->orderByDesc('change_pct')
            ->limit($limit)
            ->get();
    }

    public function topLosers(int $limit = 100)
    {
        return DB::table('instrument_snapshot')
            ->orderBy('change_pct')
            ->limit($limit)
            ->get();
    }
}
