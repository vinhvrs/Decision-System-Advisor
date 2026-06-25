<?php

namespace Platform\Plugins\Trading\Src\Services;

use Platform\Plugins\Trading\Src\Models\InstrumentData;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\InstrumentRepository;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\InstrumentDataRepository;
use App\Support\DsaTables;

use Illuminate\Support\Collection;
use Carbon\Carbon;

class SimilarSignalService
{
    protected int $N = 20;
    protected int $M = 3;
    protected int $K = 10;

    protected InstrumentRepository $instrumentRepository;
    protected InstrumentDataRepository $instrumentDataRepository;

    public function __construct()
    {
        $this->instrumentRepository = new InstrumentRepository();
        $this->instrumentDataRepository = new InstrumentDataRepository();
    }

    public function generateSignal(string $symbol, string $period = 'daily')
    {
        return $this->generateSignalWithPeriod($symbol, $period);
    }

    public function generateSignalWithPeriod(string $symbol, string $period = 'daily')
    {
        $instrument = $this->instrumentRepository->findAll(['symbol' => $symbol], ['*'], 1, 1, null)->first();

        $ohlcGrouped = $this->getGroupedOHLC($instrument->id, $period);

        $recent = $ohlcGrouped->slice(-($this->N + $this->M));

        if ($recent->count() < $this->N + $this->M) {
            return ['error' => 'Not enough data for pattern comparison.'];
        }

        $targetVector = $this->normalize($recent->slice(0, $this->N)->pluck('close')->toArray());

        $matches = [];

        for ($i = 0; $i < $ohlcGrouped->count() - ($this->N + $this->M); $i++) {
            $segment = $ohlcGrouped->slice($i, $this->N + $this->M)->values();

            $vec = $this->normalize($segment->slice(0, $this->N)->pluck('close')->toArray());
            $dist = $this->euclideanDistance($targetVector, $vec);

            $priceBefore = $segment[$this->N - 1]['close'];
            $priceAfter = $segment[$this->N + $this->M - 1]['close'];
            $return = ($priceAfter - $priceBefore) / $priceBefore;

            $matches[] = [
                'distance' => $dist,
                'start_date' => $segment[0]['timestamp'],
                'end_date' => $segment[$this->N - 1]['timestamp'],
                'return_after' => round($return, 4),
            ];
        }

        $topMatches = collect($matches)->sortBy('distance')->take($this->K);

        $meanReturn = $topMatches->avg('return_after');
        $winRatio = $topMatches->filter(fn($m) => $m['return_after'] > 0)->count() / max(1, $topMatches->count());

        $signal = 'hold';
        if ($meanReturn > 0.01 && $winRatio > 0.6) {
            $signal = 'buy';
        } elseif ($meanReturn < -0.01 && $winRatio < 0.4) {
            $signal = 'sell';
        }

        return [
            'symbol' => $symbol,
            'period' => $period,
            'signal' => $signal,
            'confidence' => round(abs($meanReturn) * $winRatio, 2),
            'mean_return' => round($meanReturn, 4),
            'win_ratio' => round($winRatio, 2),
            'top_matches' => $topMatches->values(),
        ];
    }

    protected function getGroupedOHLC(string $instrumentId, string $period): Collection
{
    $periodTable = DsaTables::name('instrument_periods');
    $raw = InstrumentData::query()
        ->join($periodTable, 'instrument_data.instrument_period_id', '=', "{$periodTable}.id")
        ->where("{$periodTable}.instrument_id", $instrumentId)
        ->where("{$periodTable}.period", $period)
        ->orderBy('instrument_data.timestamps')
        ->select([
            'instrument_data.open',
            'instrument_data.close',
            'instrument_data.high',
            'instrument_data.low',
            'instrument_data.timestamps as timestamp'
        ])
        ->get();

    return $raw->groupBy(function ($row) use ($period) {
        return match ($period) {
            'daily' => Carbon::parse($row->timestamp)->format('Y-m-d'),
            'weekly' => Carbon::parse($row->timestamp)->startOfWeek()->format('o-W'),
            'monthly' => Carbon::parse($row->timestamp)->format('Y-m'),
            'yearly' => Carbon::parse($row->timestamp)->format('Y'),
            default => Carbon::parse($row->timestamp)->format('Y-m-d'),
        };
    })->map(function ($group) {
        return [
            'timestamp' => $group->first()->timestamp,
            'open' => $group->first()->open,
            'close' => $group->last()->close,
            'high' => $group->max('high'),
            'low' => $group->min('low'),
        ];
    })->values();
}


    protected function normalize(array $sequence): array
    {
        $base = $sequence[0] ?? 1;
        return array_map(fn($x) => ($x - $base) / $base, $sequence);
    }

    protected function euclideanDistance(array $a, array $b): float
    {
        $sum = 0;
        foreach ($a as $i => $val) {
            $sum += pow($val - $b[$i], 2);
        }
        return sqrt($sum);
    }
}
