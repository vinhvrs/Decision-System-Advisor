<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Services\AnalysistService;
use Platform\Plugins\Trading\Src\Services\IndicatorAggregatorService;

class AnalysistController extends Controller
{
    protected $analysistService;
    protected $indicatorAggregatorService;

    public function __construct(AnalysistService $analysistService, IndicatorAggregatorService $indicatorAggregatorService)
    {
        $this->analysistService = $analysistService;
        $this->indicatorAggregatorService = $indicatorAggregatorService;
    }
    public function Aggregator(Request $request)
    {
        $data = $request->validate([
            'symbol' => ['required', 'string'],
            'period' => ['nullable', 'string'],
            'price' => ['required', 'numeric'],
        ]);

        $period = $data['period'] ?? 'daily';

        $summary = $this->analysistService
            ->Indicator_Summary($data['symbol'], $period)
            ->getData(true);

        $decision = $this->indicatorAggregatorService->aggregate(
            $summary,
            (float) $data['price']
        );

        return response()->json($decision);
    }

    public function IndicatorSummary(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');

        $data = $this->analysistService->Indicator_Summary($symbol, $period);
        return $data;
    }

    public function SMA(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');
        $n = (int) $request->input('n', 14);

        $sma = $this->analysistService->Indicator_SMA($symbol, $period, $n);
        return $sma;
    }

    public function EMA(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');
        $n = (int) $request->input('n', 14);

        $ema = $this->analysistService->Indicator_EMA($symbol, $period, $n);
        return $ema;
    }

    public function MACD(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');
        $fast = (int) $request->input('fast', 12);
        $slow = (int) $request->input('slow', 26);
        $signal = (int) $request->input('signal', 9);

        return $this->analysistService->Indicator_MACD($symbol, $period, $fast, $slow, $signal);
    }

    public function RSI(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');
        return $this->analysistService->Indicator_RSI($symbol, $period);
    }

    public function BollingerBands(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');
        $stdDevMultiplier = (float) $request->input('stdDevMultiplier', 2.0);

        return $this->analysistService->Indicator_BollingerBands($symbol, $period, $stdDevMultiplier);
    }

    public function StochasticOscillator(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');
        $kPeriod = (int) $request->input('kPeriod', 14);
        $dPeriod = (int) $request->input('dPeriod', 3);
        return $this->analysistService->Indicator_StochasticOscillator($symbol, $period, $kPeriod, $dPeriod);
    }
}