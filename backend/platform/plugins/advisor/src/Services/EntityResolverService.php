<?php

namespace Platform\Plugins\Advisor\Src\Services;

use Illuminate\Support\Facades\DB;

class EntityResolverService
{
    public function resolve(array $candidates): array
    {
        $resolved = [];

        foreach ($candidates as $candidate) {
            $entity = $this->resolveCompanyOrSymbol($candidate);
            if ($entity) {
                $resolved[] = $entity;
            }
        }

        return $resolved;
    }

    public function resolveCompanyOrSymbol(string $query): ?array
    {
        $q = $this->norm($query);

        // 1️⃣ Exact alias match
        $exact = DB::table('stock_entity_aliases as a')
            ->join('stock_entities as e', 'e.id', '=', 'a.entity_id')
            ->where('e.type', 'company')
            ->where('a.alias_norm', $q)
            ->orderByDesc('a.weight')
            ->orderByDesc('e.priority')
            ->select('e.symbol', 'e.name', 'a.alias', 'a.weight', 'e.priority')
            ->first();

        if ($exact) {
            return [
                'symbol'     => $exact->symbol,
                'name'       => $exact->name,
                'confidence' => 0.95,
                'method'     => 'alias_exact',
            ];
        }

        // 2️⃣ LIKE alias candidates
        $cands = DB::table('stock_entity_aliases as a')
            ->join('stock_entities as e', 'e.id', '=', 'a.entity_id')
            ->where('e.type', 'company')
            ->where('a.alias_norm', 'like', '%' . $q . '%')
            ->orderByDesc('a.weight')
            ->orderByDesc('e.priority')
            ->limit(20)
            ->select('e.symbol', 'e.name', 'a.alias_norm', 'a.weight', 'e.priority')
            ->get();

        // 3️⃣ Fallback by entity name
        if ($cands->isEmpty()) {
            $cands = DB::table('stock_entities')
                ->where('type', 'company')
                ->whereRaw('LOWER(name) LIKE ?', ['%' . $q . '%'])
                ->orderByDesc('priority')
                ->limit(20)
                ->get()
                ->map(fn($e) => (object)[
                    'symbol'     => $e->symbol,
                    'name'       => $e->name,
                    'alias_norm' => $this->norm($e->name),
                    'weight'     => 1,
                    'priority'   => $e->priority,
                ]);
        }

        if ($cands->isEmpty()) {
            return null;
        }

        // 4️⃣ Levenshtein best match
        $best = null;
        $bestScore = PHP_INT_MAX;

        foreach ($cands as $c) {
            $dist = levenshtein($q, $c->alias_norm);
            if ($dist < $bestScore) {
                $bestScore = $dist;
                $best = $c;
            }
        }

        if (!$best) {
            return null;
        }

        $len = max(strlen($q), 1);
        $confidence = max(0.0, 1.0 - ($bestScore / $len));

        return [
            'symbol'     => $best->symbol,
            'name'       => $best->name,
            'confidence' => round($confidence, 2),
            'method'     => 'levenshtein',
        ];
    }

    private function norm(string $s): string
    {
        $s = mb_strtolower(trim($s));
        $s = preg_replace('/\s+/', ' ', $s) ?? $s;
        $s = preg_replace('/[^a-z0-9 .&-]/', '', $s) ?? $s;
        return trim($s);
    }
}
