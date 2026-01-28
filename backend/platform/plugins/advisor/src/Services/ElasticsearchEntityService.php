<?php

// namespace Platform\Plugins\Advisor\Src\Services;

// use Illuminate\Support\Facades\Http;

// class ElasticsearchEntityService
// {
//     private string $host;
//     private string $index;

//     public function __construct()
//     {
//         $this->host  = rtrim(config('services.elastic.host'), '/');
//         $this->index = config('services.elastic.index', 'dsa_entities');
//     }

//     /**
//      * Resolve company/indicator from a user query (with fuzziness).
//      * Returns: ['best'=>..., 'candidates'=>[...]]
//      */
//     public function resolve(string $query, string $type = 'company', int $size = 5): array
//     {
//         $query = trim($query);
//         if ($query === '') {
//             return ['best' => null, 'candidates' => []];
//         }

//         $body = [
//             'size' => $size,
//             'query' => [
//                 'bool' => [
//                     'filter' => [
//                         ['term' => ['type' => $type]]
//                     ],
//                     'should' => [
//                         // exact-ish boost for symbol
//                         ['term' => ['symbol' => ['value' => strtoupper($query), 'boost' => 10]]],
//                         // fuzzy match on symbol/name/aliases
//                         ['multi_match' => [
//                             'query' => $query,
//                             'fields' => ['symbol^6', 'name^3', 'aliases^2', 'fuzzy_aliases'],
//                             'fuzziness' => 'AUTO',
//                         ]],
//                     ],
//                 ],
//             ],
//         ];

//         $res = Http::timeout(10)
//             ->acceptJson()
//             ->post("{$this->host}/{$this->index}/_search", $body);

//         if (!$res->ok()) {
//             return [
//                 'best' => null,
//                 'candidates' => [],
//                 'error' => $res->body(),
//             ];
//         }

//         $hits = $res->json('hits.hits') ?? [];
//         if (!$hits) return ['best' => null, 'candidates' => []];

//         $candidates = array_map(function ($h) {
//             $src = $h['_source'] ?? [];
//             return [
//                 'type' => $src['type'] ?? null,
//                 'symbol' => $src['symbol'] ?? null,
//                 'name' => $src['name'] ?? null,
//                 'score' => $h['_score'] ?? 0,
//                 'priority' => $src['priority'] ?? 0,
//             ];
//         }, $hits);

//         // Simple confidence heuristic from score (tune later)
//         $best = $candidates[0];
//         $best['confidence'] = $this->scoreToConfidence((float)($best['score'] ?? 0));

//         return [
//             'best' => $best,
//             'candidates' => $candidates,
//         ];
//     }

//     /**
//      * Import entities from frontend request (bulk).
//      * Expect items like:
//      *  { type, symbol, name, aliases:[], fuzzy_aliases:[], priority }
//      */
//     public function import(array $items): array
//     {
//         // build NDJSON for _bulk
//         $lines = [];
//         foreach ($items as $item) {
//             if (empty($item['type']) || empty($item['name'])) continue;

//             $doc = [
//                 'type' => (string)$item['type'],
//                 'symbol' => isset($item['symbol']) ? (string)$item['symbol'] : null,
//                 'name' => (string)$item['name'],
//                 'aliases' => array_values(array_filter($item['aliases'] ?? [])),
//                 'fuzzy_aliases' => array_values(array_filter($item['fuzzy_aliases'] ?? [])),
//                 'priority' => (int)($item['priority'] ?? 0),
//             ];

//             $lines[] = json_encode(['index' => ['_index' => $this->index]], JSON_UNESCAPED_UNICODE);
//             $lines[] = json_encode($doc, JSON_UNESCAPED_UNICODE);
//         }

//         if (empty($lines)) {
//             return ['ok' => false, 'message' => 'No valid items to import.'];
//         }

//         $ndjson = implode("\n", $lines) . "\n";

//         $res = Http::timeout(20)
//             ->withHeaders(['Content-Type' => 'application/x-ndjson'])
//             ->withBody($ndjson, 'application/x-ndjson')
//             ->post("{$this->host}/_bulk");

//         if (!$res->ok()) {
//             return ['ok' => false, 'error' => $res->body()];
//         }

//         // refresh for immediate search
//         Http::timeout(10)->post("{$this->host}/{$this->index}/_refresh");

//         $json = $res->json();
//         return [
//             'ok' => true,
//             'errors' => $json['errors'] ?? null,
//             'took' => $json['took'] ?? null,
//         ];
//     }

//     private function scoreToConfidence(float $score): float
//     {
//         // Very simple scaling: score 0..10 -> confidence 0..1
//         $c = $score / 10.0;
//         if ($c < 0) $c = 0;
//         if ($c > 1) $c = 1;
//         return round($c, 3);
//     }
// }

namespace Platform\Plugins\Advisor\Src\Services;

use Elastic\Elasticsearch\Client;

class ElasticsearchEntityService
{
    public function __construct(
        protected Client $client
    ) {}

    public function getMarketData(string $symbol): array
    {
        // placeholder – bạn có thể thay bằng index thật
        return [
            'symbol'     => $symbol,
            'price'      => null,
            'volume'     => null,
            'ohlcv'      => null,
            'source'     => 'elasticsearch',
        ];
    }
}
