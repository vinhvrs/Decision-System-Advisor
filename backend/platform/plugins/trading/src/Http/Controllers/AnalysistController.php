<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Services\AnalysistService;

class AnalysistController extends Controller
{
    protected $analysistService;

    public function __construct(AnalysistService $analysistService)
    {
        $this->analysistService = $analysistService;
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
        $period = (int) $request->input('period', 14);
        $n = (int) $request->input('n', 14);

        $ema = $this->analysistService->Indicator_EMA($symbol, $period, $n);
        return $ema;
    }

    public function MACD(Request $request, string $symbol)
    {
        $period = $request->query('period', 'daily');
        $fast = (int) $request->query('fast', 12);
        $slow = (int) $request->query('slow', 26);
        $signal = (int) $request->query('signal', 9);

        return $this->analysistService->Indicator_MACD($symbol, $period, $fast, $slow, $signal);
    }

    public function RSI(Request $request, string $symbol)
    {
        $period = $request->query('period', 'daily');
        return $this->analysistService->Indicator_RSI($symbol, $period);
    }

    public function BollingerBands(Request $request, string $symbol)
    {
        $period = $request->query('period', 'daily');
        $stdDevMultiplier = (float) $request->query('stdDevMultiplier', 2.0);

        return $this->analysistService->Indicator_BollingerBands($symbol, $period, $stdDevMultiplier);
    }

    public function StochasticOscillator(Request $request, string $symbol)
    {
        $period = $request->query('period', 'daily');
        $kPeriod = (int) $request->query('kPeriod', 14);
        $dPeriod = (int) $request->query('dPeriod', 3);

        return $this->analysistService->Indicator_StochasticOscillator($symbol, $period, $kPeriod, $dPeriod);
    }
}