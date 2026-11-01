<?php

namespace Platform\Plugins\Advisor\Src\Services\Context;

class ContextMerger
{
    public function merge(array $vectorResults, array $elasticResults): array
    {
        $merged = [];

        foreach ($vectorResults as $v) {
            $id = $v['payload']['chunk_id'] ?? $v['id'];

            $merged[$id] = [
                'id' => $id,
                'vector_score' => $v['score'],
                'elastic_score' => 0,
                'payload' => $v['payload']
            ];
        }

        foreach ($elasticResults as $e) {
            $id = $e['id'];

            if (!isset($merged[$id])) {
                $merged[$id] = [
                    'id' => $id,
                    'vector_score' => 0,
                    'elastic_score' => $e['score'],
                    'payload' => $e['payload']
                ];
            } else {
                $merged[$id]['elastic_score'] = $e['score'];
            }
        }

        foreach ($merged as &$item) {
            $item['final_score'] =
                0.55 * $item['vector_score'] +
                0.35 * $this->normalize($item['elastic_score']) +
                0.10 * $this->recencyBoost($item['payload']['published_at'] ?? null);
        }

        usort($merged, fn($a, $b) => $b['final_score'] <=> $a['final_score']);

        return array_slice($merged, 0, 10);
    }

    private function normalize($score): float
    {
        return min($score / 10, 1);
    }

    private function recencyBoost($date): float
    {
        if (!$date) return 0;

        $days = now()->diffInDays($date);

        return max(0, 1 - ($days / 30));
    }
}