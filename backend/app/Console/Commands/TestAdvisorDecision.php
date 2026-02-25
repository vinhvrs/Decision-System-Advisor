<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Platform\Plugins\Trading\Src\Services\AnalysistService;
use Platform\Plugins\Trading\Src\Services\IndicatorAggregatorService;
use Platform\Plugins\Advisor\Src\Services\ResponseComposerService;

class TestAdvisorDecision extends Command
{
    protected $signature = 'advisor:test-decision {symbol=AAPL} {period=daily}';
    protected $description = 'Test technical analysis → decision → explanation';

    public function handle(
        AnalysistService $analysist,
        IndicatorAggregatorService $aggregator,
        ResponseComposerService $composer
    ): int {
        $symbol = strtoupper($this->argument('symbol'));
        $period = $this->argument('period');

        $this->info("Analyzing {$symbol} ({$period})");

        // 1️⃣ Indicator summary
        $summary = $analysist
            ->Indicator_Summary($symbol, $period)
            ->getData(true);

        if (empty($summary)) {
            $this->error("No indicator data found.");
            return self::FAILURE;
        }

        $price = (float) $summary['price'];

        // 2️⃣ Aggregate decision
        $decision = $aggregator->aggregate($summary, $price);

        $this->info("Decision Raw:");
        $this->line(print_r($decision, true));

        // 3️⃣ Compose explanation
        $response = $composer->compose(
            $decision,
            [
                'profile' => 'spoken_professional',
                'style' => 'standard',
                'constraints' => [],
            ]
        );

        $this->info("Final Output:");
        $this->line(print_r($response, true));

        return self::SUCCESS;
    }
}