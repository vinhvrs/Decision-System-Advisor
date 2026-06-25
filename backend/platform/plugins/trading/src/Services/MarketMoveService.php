<?php

namespace Platform\Plugins\Trading\Src\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use App\Support\DsaTables;
use Platform\Plugins\Trading\Src\Models\Instruments;

class MarketMoveService
{
    protected string $gainerKey = 'market:movers:gainers';
    protected string $loserKey = 'market:movers:losers';

    public function rebuildDaily(): int
    {
        $top = [];
        $bottom = [];
        $count = 0;

        Instruments::query()
            ->select('id', 'symbol', 'name')
            ->chunk(1000, function ($instruments) use (&$top, &$bottom, &$count) {

                $ids = $instruments->pluck('id')->toArray();
                $dataTable = DsaTables::name('instrument_data');
                $periodTable = DsaTables::name('instrument_periods');

                $rows = DB::table("{$dataTable} as d")
                    ->join("{$periodTable} as p", 'p.id', '=', 'd.instrument_period_id')
                    ->where('p.period', 'daily')
                    ->whereIn('p.instrument_id', $ids)
                    ->whereRaw("d.timestamps = (
                        SELECT MAX(d2.timestamps)
                        FROM {$dataTable} d2
                        WHERE d2.instrument_period_id = d.instrument_period_id
                    )")
                    ->select('p.instrument_id', 'd.open', 'd.close', 'd.volume')
                    ->get()
                    ->keyBy('instrument_id');

                foreach ($instruments as $inst) {

                    $data = $rows->get($inst->id);
                    if (!$data || $data->open <= 0) continue;

                    $change = (($data->close - $data->open) / $data->open) * 100;

                    $item = [
                        'symbol' => $inst->symbol,
                        'name' => $inst->name,
                        'change_pct' => round($change, 2),
                        'price' => (float)$data->close,
                        'volume' => (float)$data->volume,
                    ];

                    $count++;

                    // ===== TOP GAINERS =====
                    $top[] = $item;
                    usort($top, fn($a,$b)=> $b['change_pct'] <=> $a['change_pct']);
                    if(count($top) > 50) array_pop($top);

                    // ===== TOP LOSERS =====
                    $bottom[] = $item;
                    usort($bottom, fn($a,$b)=> $a['change_pct'] <=> $b['change_pct']);
                    if(count($bottom) > 50) array_pop($bottom);
                }
            });

        Redis::pipeline(function ($pipe) use ($top, $bottom) {
            $pipe->set($this->gainerKey, json_encode($top));
            $pipe->set($this->loserKey, json_encode($bottom));
            $pipe->expire($this->gainerKey, 86400);
            $pipe->expire($this->loserKey, 86400);
        });

        return $count;
    }
}
