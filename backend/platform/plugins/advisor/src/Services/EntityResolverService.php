<?php

// namespace Platform\Plugins\Advisor\Src\Services;

// use Illuminate\Support\Facades\DB;

// class EntityResolverService
// {
//     public function resolveCompanyOrSymbol(string $query): ?array
//     {
//         $q = $this->norm($query);

//         // 1) Exact alias match
//         $exact = DB::table('stock_entity_aliases as a')
//             ->join('stock_entities as e', 'e.id', '=', 'a.entity_id')
//             ->where('e.type', 'company')
//             ->where('a.alias_norm', $q)
//             ->orderByDesc('a.weight')
//             ->orderByDesc('e.priority')
//             ->select('e.symbol', 'e.name', 'a.alias', 'a.weight', 'e.priority')
//             ->first();

//         if ($exact) {
//             return [
//                 'symbol' => $exact->symbol,
//                 'name' => $exact->name,
//                 'confidence' => 0.95,
//                 'method' => 'alias_exact',
//             ];
//         }

//         // 2) LIKE candidates
//         $cands = DB::table('stock_entity_aliases as a')
//             ->join('stock_entities as e', 'e.id', '=', 'a.entity_id')
//             ->where('e.type', 'company')
//             ->where('a.alias_norm', 'like', '%' . $q . '%')
//             ->orderByDesc('a.weight')
//             ->orderByDesc('e.priority')
//             ->limit(20)
//             ->select('e.symbol', 'e.name', 'a.alias_norm', 'a.alias', 'a.weight', 'e.priority')
//             ->get();

//         if ($cands->isEmpty()) {
//             // fallback: search by entity name
//             $cands = DB::table('stock_entities')
//                 ->where('type', 'company')
//                 ->whereRaw('LOWER(name) LIKE ?', ['%' . $q . '%'])
//                 ->orderByDesc('priority')
//                 ->limit(20)
//                 ->get()
//                 ->map(fn($e) => (object)[
//                     'symbol' => $e->symbol,
//                     'name' => $e->name,
//                     'alias_norm' => $this->norm($e->name),
//                     'alias' => $e->name,
//                     'weight' => 1,
//                     'priority' => $e->priority,
//                 ]);
//         }

//         if ($cands->isEmpty()) return null;

//         // 3) Compute Levenshtein distance in PHP
//         $best = null;
//         $bestScore = PHP_INT_MAX;

//         foreach ($cands as $c) {
//             $dist = levenshtein($q, $c->alias_norm);
//             if ($dist < $bestScore) {
//                 $bestScore = $dist;
//                 $best = $c;
//             }
//         }

//         if (!$best) return null;

//         // Convert distance -> confidence (simple heuristic)
//         $len = max(strlen($q), 1);
//         $confidence = max(0.0, 1.0 - ($bestScore / $len));

//         return [
//             'symbol' => $best->symbol,
//             'name' => $best->name,
//             'confidence' => $confidence,
//             'method' => 'levenshtein',
//             'distance' => $bestScore,
//         ];
//     }

//     private function norm(string $s): string
//     {
//         $s = mb_strtolower(trim($s));
//         $s = preg_replace('/\s+/', ' ', $s) ?? $s;
//         $s = preg_replace('/[^a-z0-9 .&-]/', '', $s) ?? $s; // keep basic chars
//         return trim($s);
//     }
// }


namespace Platform\Plugins\Advisor\Src\Services;

use Platform\Plugins\Advisor\Src\DTO\Decision;

class EntityResolverService
{
    public function resolve(Decision $decision): array
    {
        if (empty($decision->entity['symbol'])) {
            return [];
        }

        return [
            'symbol' => $decision->entity['symbol'],
            'market' => $this->detectMarket($decision->entity['symbol']),
        ];
    }

    protected function detectMarket(string $symbol): string
    {
        // simple heuristic – can expand later
        return ctype_upper($symbol) ? 'US' : 'UNKNOWN';
    }
}
