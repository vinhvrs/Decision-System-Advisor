<?php
namespace Platform\Plugins\Trading\Src\Repositories\Interfaces;

use Illuminate\Support\Collection;

interface IndicatorMathInterface {
    public function calculateSMA(array $data, int $period): array;
    public function calculateEMA(array $data, int $period): array;
    public function calculateRSI(array $data, int $period): array;
    public function calculateMACD(array $data, int $fastPeriod, int $slowPeriod, int $signalPeriod): array;
    public function calculateBollingerBands(array $data, int $period, float $stdDevMultiplier): array;
    public function calculateStochasticOscillator(array $data, int $kPeriod, int $dPeriod): array;
    public function detectCrossovers(array $series1, array $series2): string;
    public function detectCrossoverAt(array $series1, array $series2, int $t): string;
    public function getLastCandles(string $symbol, string $period, int $limit = 500): Collection;
}