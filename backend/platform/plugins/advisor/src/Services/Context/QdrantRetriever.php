<?php

namespace Platform\Plugins\Advisor\Src\Services\Context;

use Platform\Plugins\Advisor\Src\Services\QdrantService;

class QdrantRetriever
{
    public function __construct(private QdrantService $qdrant) {}

    public function search(array $vector, int $limit = 5, ?string $symbol = null): array
    {
        $filter = [];

        if ($symbol) {
            $filter = [
                'must' => [
                    ['key' => 'symbol', 'match' => ['value' => $symbol]],
                ],
            ];
        }

        return $this->qdrant->search($vector, $limit, $filter);
    }
}