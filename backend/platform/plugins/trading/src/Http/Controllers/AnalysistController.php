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

        $period = $data['period'] ?? $this->defaultPeriod();

        $summary = $this->analysistService->indicatorSummaryData($data['symbol'], $period);

        $decision = $this->indicatorAggregatorService->aggregate(
            $summary,
            (float) $data['price']
        );

        return response()->json($decision);
    }

    public function IndicatorSummary(Request $request, string $symbol)
    {
        $period = $request->input('period', $this->defaultPeriod());
        return response()->json($this->analysistService->indicatorSummaryData($symbol, $period));
    }

    public function SMA(Request $request, string $symbol)
    {
        $period = $request->input('period', $this->defaultPeriod());
        $n = (int) $request->input('n', 0);

        return $this->respondIndicator($this->analysistService->indicatorSmaData($symbol, $period, $n));
    }

    public function EMA(Request $request, string $symbol)
    {
        $period = $request->input('period', $this->defaultPeriod());
        $n = (int) $request->input('n', 0);

        return $this->respondIndicator($this->analysistService->indicatorEmaData($symbol, $period, $n));
    }

    public function MACD(Request $request, string $symbol)
    {
        $period = $request->input('period', $this->defaultPeriod());
        $fast = (int) $request->input('fast', 0);
        $slow = (int) $request->input('slow', 0);
        $signal = (int) $request->input('signal', 0);

        return $this->respondIndicator($this->analysistService->indicatorMacdData($symbol, $period, $fast, $slow, $signal));
    }

    public function RSI(Request $request, string $symbol)
    {
        $period = $request->input('period', $this->defaultPeriod());
        $n = (int) $request->input('n', 0);
        return $this->respondIndicator($this->analysistService->indicatorRsiData($symbol, $period, $n));
    }

    public function BollingerBands(Request $request, string $symbol)
    {
        $period = $request->input('period', $this->defaultPeriod());
        $stdDevMultiplier = (float) $request->input('stdDevMultiplier', 0.0);
        $n = (int) $request->input('n', 0);

        return $this->respondIndicator($this->analysistService->indicatorBollingerBandsData($symbol, $period, $stdDevMultiplier, $n));
    }

    public function StochasticOscillator(Request $request, string $symbol)
    {
        $period = $request->input('period', $this->defaultPeriod());
        $kPeriod = (int) $request->input('kPeriod', 0);
        $dPeriod = (int) $request->input('dPeriod', 0);
        return $this->respondIndicator($this->analysistService->indicatorStochasticOscillatorData($symbol, $period, $kPeriod, $dPeriod));
    }

    private function respondIndicator(array $payload): JsonResponse
    {
        $status = array_key_exists('error', $payload) ? 422 : 200;
        return response()->json($payload, $status);
    }

    private function defaultPeriod(): string
    {
        $period = trim((string) config('trading_indicators.default_period', 'daily'));
        return $period !== '' ? $period : 'daily';
    }
}
