<?php

namespace Platform\Plugins\Advisor\Src\Services;

class StrategyResolverService
{
    protected array $strategy;

    public function __construct()
    {
        $this->strategy = require __DIR__ . '/../Dictionaries/strategy.php';
    }

    public function resolve(string $intent): array
    {
        return $this->strategy[$intent]
            ?? $this->strategy['unknown'];
    }

    public function getStopwords(): array
    {
        return array_merge(
            $this->strategy['stopwords'] ?? [],
            $this->strategy['fillers'] ?? [],
            $this->strategy['verbs'] ?? []
        );
    }

    public function getNegations(): array
    {
        return $this->strategy['negations'] ?? [];
    }
}
