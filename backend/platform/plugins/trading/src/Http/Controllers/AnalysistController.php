<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;
use Illuminate\Http\JsonResponse;
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

        $summary = $this->analysistService->indicatorSummaryData($data['symbol'], $period);

        $decision = $this->indicatorAggregatorService->aggregate(
            $summary,
            (float) $data['price']
        );

        return response()->json($decision);
    }

    public function IndicatorSummary(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');
        return response()->json($this->analysistService->indicatorSummaryData($symbol, $period));
    }

    public function SMA(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');
        $n = (int) $request->input('n', 14);

        return $this->respondIndicator($this->analysistService->indicatorSmaData($symbol, $period, $n));
    }

    public function EMA(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');
        $n = (int) $request->input('n', 14);

        return $this->respondIndicator($this->analysistService->indicatorEmaData($symbol, $period, $n));
    }

    public function MACD(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');
        $fast = (int) $request->input('fast', 12);
        $slow = (int) $request->input('slow', 26);
        $signal = (int) $request->input('signal', 9);

        return $this->respondIndicator($this->analysistService->indicatorMacdData($symbol, $period, $fast, $slow, $signal));
    }

    public function RSI(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');
        return $this->respondIndicator($this->analysistService->indicatorRsiData($symbol, $period));
    }

    public function BollingerBands(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');
        $stdDevMultiplier = (float) $request->input('stdDevMultiplier', 2.0);

        return $this->respondIndicator($this->analysistService->indicatorBollingerBandsData($symbol, $period, $stdDevMultiplier));
    }

    public function StochasticOscillator(Request $request, string $symbol)
    {
        $period = $request->input('period', 'daily');
        $kPeriod = (int) $request->input('kPeriod', 14);
        $dPeriod = (int) $request->input('dPeriod', 3);
        return $this->respondIndicator($this->analysistService->indicatorStochasticOscillatorData($symbol, $period, $kPeriod, $dPeriod));
    }

    private function respondIndicator(array $payload): JsonResponse
    {
        $status = array_key_exists('error', $payload) ? 422 : 200;
        return response()->json($payload, $status);
    }
}