<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Platform\Plugins\Trading\Src\Models\StockAttribute;
use Platform\Plugins\Trading\Src\Models\Instruments;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FetchStockAttributes extends Command
{
    protected $signature = 'stocks:fetch';

    protected $description = 'Fetch stock attribute data from FMP API and store into database';

    protected function confidenceScoreCalc($data): int
    {
        // confidence_point =  W1 * revenue_consistency_score +
        // W2 * eps_consistency_score +
        // W3 * analyst_count_score +
        // W4 * profit_margin_score
        $confidenceScore = 0;

        $spreadRevenue = $data['revenue_high'] - $data['revenue_low'];
        $percentSpread = $spreadRevenue / $data['revenue_avg'];
        if ($percentSpread <= 0.02)       $confidenceScore += 25;
        else if ($percentSpread <= 0.05)  $confidenceScore += 20;
        else if ($percentSpread <= 0.08)  $confidenceScore += 15;
        else if ($percentSpread <= 0.12)  $confidenceScore += 10;
        else                               $confidenceScore += 5;

        $spreadEps = $data['eps_high'] - $data['eps_low'];
        $percentSpreadEps = $spreadEps / $data['eps_avg'];
        if ($percentSpreadEps <= 0.03)       $confidenceScore += 25;
        else if ($percentSpreadEps <= 0.07)  $confidenceScore += 20;
        else if ($percentSpreadEps <= 0.1)  $confidenceScore += 15;
        else if ($percentSpreadEps <= 0.15)  $confidenceScore += 10;
        else                                   $confidenceScore += 5;

        $totalAnalysts = min($data['num_analysts_revenue'], $data['num_analysts_eps']);
        if ($totalAnalysts >= 15)       $confidenceScore += 25;
        else if ($totalAnalysts >= 10)  $confidenceScore += 20;
        else if ($totalAnalysts >= 7)   $confidenceScore += 15;
        else if ($totalAnalysts >= 4)   $confidenceScore += 10;
        else                             $confidenceScore += 5;

        $profitMargin = $data['net_income_avg'] / $data['revenue_avg'];
        if ($profitMargin >= 0.3)       $confidenceScore += 25;
        else if ($profitMargin >= 0.25)  $confidenceScore += 20;
        else if ($profitMargin >= 0.2)  $confidenceScore += 15;
        else if ($profitMargin >= 0.15)   $confidenceScore += 10;
        else                             $confidenceScore += 5;

        return $confidenceScore;
    }

    public function handle()
    {
        Log::info('[Schedule] schedule() method called');
        
        $this->info('📡 FetchStockAttributes is running...');

        $apiKey = config('services.fmp.key');
        $symbols = Instruments::pluck('symbol');

        foreach ($symbols as $symbol) {
            $response = Http::get("https://financialmodelingprep.com/stable/analyst-estimates?symbol={$symbol}&period=annual&page=0&limit=5&apikey={$apiKey}");
            $targetYear = now()->year;
            $data = collect($response->json())
                ->first(function ($item) use ($targetYear) {
                    return isset($item['date']) && str_starts_with($item['date'], (string) $targetYear);
                }) ?? null;
            dump($targetYear);
            dump($data);

            if ($data) {
                $payload = [
                    'revenue_low' => $data['revenueLow'] ?? 0,
                    'revenue_high' => $data['revenueHigh'] ?? 0,
                    'revenue_avg' => $data['revenueAvg'] ?? 0,

                    'ebitda_low' => $data['ebitdaLow'] ?? 0,
                    'ebitda_high' => $data['ebitdaHigh'] ?? 0,
                    'ebitda_avg' => $data['ebitdaAvg'] ?? 0,

                    'ebit_low' => $data['ebitLow'] ?? 0,
                    'ebit_high' => $data['ebitHigh'] ?? 0,
                    'ebit_avg' => $data['ebitAvg'] ?? 0,

                    'net_income_low' => $data['netIncomeLow'] ?? 0,
                    'net_income_high' => $data['netIncomeHigh'] ?? 0,
                    'net_income_avg' => $data['netIncomeAvg'] ?? 0,

                    'sga_expense_low' => $data['sgaExpenseLow'] ?? 0,
                    'sga_expense_high' => $data['sgaExpenseHigh'] ?? 0,
                    'sga_expense_avg' => $data['sgaExpenseAvg'] ?? 0,

                    'eps_low' => $data['epsLow'] ?? 0,
                    'eps_high' => $data['epsHigh'] ?? 0,
                    'eps_avg' => $data['epsAvg'] ?? 0,

                    'num_analysts_revenue' => $data['numAnalystsRevenue'] ?? 0,
                    'num_analysts_eps' => $data['numAnalystsEps'] ?? 0,

                    'confidence_score' => rand(70, 99),
                    'recommendation' => $data['rating'] ?? 'Hold',
                ];

                $fields = collect((new StockAttribute)->getFillable())
                    ->reject(fn($key) => in_array($key, ['id', 'instrument_id', 'date', 'created_at', 'updated_at']))
                    ->mapWithKeys(function ($field) use ($payload) {
                        return [$field => $payload[$field] ?? 0];
                    })
                    ->toArray();

                $fields['instrument_id'] = Instruments::where('symbol', $symbol)->value('id');
                $fields['date'] = now()->toDateString();
                $fields['confidence_score'] = $this->confidenceScoreCalc($payload);
                if ($fields['confidence_score'] <= 39) {
                    $fields['recommendation'] = 'Sell';
                } else if ($fields['confidence_score'] <= 59) {
                    $fields['recommendation'] = 'Hold';
                } else if ($fields['confidence_score'] <= 79) {
                    $fields['recommendation'] = 'Buy';
                } else if ($fields['confidence_score'] <= 100) {
                    $fields['recommendation'] = 'Buy'; //'Strong Buy';
                } else {
                    $fields['recommendation'] = 'Hold';
                }

                StockAttribute::create($fields);

                $this->info("Fetched and saved for {$symbol}");
            } else {
                $this->warn("No data for {$symbol}");
            }
        }
    }
}
