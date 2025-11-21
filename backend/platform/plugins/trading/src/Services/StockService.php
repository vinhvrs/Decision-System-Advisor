<?php
namespace Platform\Plugins\Trading\Src\Services;
use Illuminate\Support\Facades\Http;
use Platform\Plugins\Trading\Src\Models\StockAttribute;
use Platform\Plugins\Trading\Src\Models\Instruments;

class StockService
{
     /**
     * Calculate confidence score based on data consistency and analyst coverage
     */
protected function confidenceScoreCalc(array $data): int
    {
        $score = 0;

        // Revenue consistency
        $spreadRevenue = $data['revenue_high'] - $data['revenue_low'];
        $spreadPct = $spreadRevenue / max($data['revenue_avg'], 1);

        $score += $spreadPct <= 0.02 ? 25 :
                 ($spreadPct <= 0.05 ? 20 :
                 ($spreadPct <= 0.08 ? 15 :
                 ($spreadPct <= 0.12 ? 10 : 5)));

        // EPS consistency
        $spreadEPS = $data['eps_high'] - $data['eps_low'];
        $spreadEPSPct = $spreadEPS / max($data['eps_avg'], 1);

        $score += $spreadEPSPct <= 0.03 ? 25 :
                 ($spreadEPSPct <= 0.07 ? 20 :
                 ($spreadEPSPct <= 0.10 ? 15 :
                 ($spreadEPSPct <= 0.15 ? 10 : 5)));

        // Analysts
        $analysts = min($data['num_analysts_revenue'], $data['num_analysts_eps']);
        $score += $analysts >= 15 ? 25 :
                  ($analysts >= 10 ? 20 :
                  ($analysts >= 7 ? 15 :
                  ($analysts >= 4 ? 10 : 5)));

        // Profit margin
        $profitMargin = $data['net_income_avg'] / max($data['revenue_avg'], 1);
        $score += $profitMargin >= 0.30 ? 25 :
                  ($profitMargin >= 0.25 ? 20 :
                  ($profitMargin >= 0.20 ? 15 :
                  ($profitMargin >= 0.15 ? 10 : 5)));

        return $score;
    }


    /**
     * Main API: calculate stock attribute for single symbol
     */
    public function calculate($symbol)
    {
        $symbol = strtoupper($symbol);
        $key = env('ALPHA_VANTAGE_API_KEY');
        if (!$key) {
            return response()->json(['error' => 'Missing AlphaVantage key'], 500);
        }

        $url = "https://www.alphavantage.co/query?function=EARNINGS&symbol={$symbol}&apikey={$key}";
        $response = Http::withOptions([
            'verify' => false
        ])->get($url);

        if (!$response->successful() || !isset($response['quarterlyEarnings'][0])) {
            return response()->json(['error' => 'No data found'], 404);
        }

        $latest = $response['quarterlyEarnings'][0];

        /**
         * EPS calculations
         */
        $reported = (float) ($latest['reportedEPS'] ?? 0);

        // estimatedEPS may be "None"
        $estimated = ($latest['estimatedEPS'] ?? "None") !== "None"
            ? (float) $latest['estimatedEPS']
            : ($reported * 0.95);

        $eps_low  = min($reported, $estimated);
        $eps_high = max($reported, $estimated);
        $eps_avg  = ($reported + $estimated) / 2;

        /**
         * Estimate revenue using EPS spread ratio
         */
        $spreadPct = abs($reported - $estimated) / max($eps_avg, 1);

        $revenue_avg = $eps_avg * 100;   // simple model
        $revenue_low = $revenue_avg * (1 - $spreadPct);
        $revenue_high = $revenue_avg * (1 + $spreadPct);

        /**
         * Net Income estimation (EPS * shares outstanding)
         */
        $shares = 16_000_000_000;

        $net_income_low  = $eps_low  * $shares;
        $net_income_high = $eps_high * $shares;
        $net_income_avg  = $eps_avg  * $shares;

        /**
         * EBITDA & EBIT estimation ratios
         */
        $ebitda_low  = $net_income_low * 0.30;
        $ebitda_high = $net_income_high * 0.30;
        $ebitda_avg  = $net_income_avg * 0.30;

        $ebit_low  = $net_income_low * 0.25;
        $ebit_high = $net_income_high * 0.25;
        $ebit_avg  = $net_income_avg * 0.25;

        /**
         * SGA expense heuristic
         */
        $sga_low  = $revenue_low  * 0.12;
        $sga_high = $revenue_high * 0.12;
        $sga_avg  = $revenue_avg * 0.12;

        /**
         * Analyst count heuristic
         */
        $analysts = ($latest['estimatedEPS'] ?? "None") !== "None"
            ? rand(10, 25)
            : rand(0, 5);

        /**
         * Prepare data in EXACT fillable format
         */
        $data = [
            'date' => now()->toDateString(),
            'instrument_id' => Instruments::where('symbol', $symbol)->value('id'),

            'revenue_low' => $revenue_low,
            'revenue_high' => $revenue_high,
            'revenue_avg' => $revenue_avg,

            'ebitda_low' => $ebitda_low,
            'ebitda_high' => $ebitda_high,
            'ebitda_avg' => $ebitda_avg,

            'ebit_low' => $ebit_low,
            'ebit_high' => $ebit_high,
            'ebit_avg' => $ebit_avg,

            'net_income_low' => $net_income_low,
            'net_income_high' => $net_income_high,
            'net_income_avg' => $net_income_avg,

            'sga_expense_low' => $sga_low,
            'sga_expense_high' => $sga_high,
            'sga_expense_avg' => $sga_avg,

            'eps_low' => $eps_low,
            'eps_high' => $eps_high,
            'eps_avg' => $eps_avg,

            'num_analysts_revenue' => $analysts,
            'num_analysts_eps' => $analysts,
        ];

        /**
         * Calculate confidence score
         */
        $confidence = $this->confidenceScoreCalc($data);
        $data['confidence_score'] = $confidence;

        /**
         * Recommendation based on confidence score
         */
        if ($confidence <= 39)        $data['recommendation'] = 'Sell';
        else if ($confidence <= 59)  $data['recommendation'] = 'Hold';
        else if ($confidence <= 79)  $data['recommendation'] = 'Buy';
        else                         $data['recommendation'] = 'Buy';

        /**
         * Convert payload
         */
        $record = [
            'instrument_id' => $data['instrument_id'],
            'date' => $data['date'],
            'details' => $data
        ];
        return response()->json([
            'symbol' => $symbol,
            'score' => $confidence,
            'recommendation' => $data['recommendation'],
            'data' => $record,
        ]);
    }
}