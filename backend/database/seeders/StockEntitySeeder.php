<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StockEntitySeeder extends Seeder
{
    public function run(): void
    {
        $path = database_path('seeders/contents/fuzzy_aliases.json');
        if (!file_exists($path)) {
            throw new \RuntimeException("Seed file not found: {$path}");
        }

        $json = json_decode(file_get_contents($path), true);
        if (!is_array($json) || empty($json['items'])) {
            throw new \RuntimeException("Invalid JSON structure in: {$path}");
        }

        DB::transaction(function () use ($json) {
            foreach ($json['items'] as $item) {
                $company = $item['company'] ?? null;
                $symbol  = $item['symbol'] ?? null;

                if (!$company || !$symbol) {
                    continue;
                }

                // 1) Upsert entity (company)
                // NOTE: nếu bạn muốn unique theo (type,symbol), hãy đảm bảo DB có unique index.
                $entityId = $this->upsertEntityCompany($company, $symbol);

                // 2) Insert aliases (aliases + fuzzy_aliases + symbol itself)
                $aliases = array_merge(
                    [$company, $symbol], // luôn thêm company name + symbol
                    $item['aliases'] ?? [],
                    $item['fuzzy_aliases'] ?? []
                );

                // Weight rule:
                // - symbol: 10
                // - company name + official aliases: 7
                // - fuzzy aliases: 3
                $officialAliases = array_merge([$company], $item['aliases'] ?? []);
                $fuzzyAliases = $item['fuzzy_aliases'] ?? [];

                foreach ($aliases as $alias) {
                    $alias = trim((string)$alias);
                    if ($alias === '') continue;

                    $aliasNorm = $this->norm($alias);

                    $weight = 5;
                    if (strtoupper($alias) === strtoupper($symbol)) $weight = 10;
                    else if (in_array($alias, $officialAliases, true)) $weight = 7;
                    else if (in_array($alias, $fuzzyAliases, true)) $weight = 3;

                    // tránh duplicate
                    $exists = DB::table('stock_entity_aliases')
                        ->where('entity_id', $entityId)
                        ->where('alias_norm', $aliasNorm)
                        ->exists();

                    if (!$exists) {
                        DB::table('stock_entity_aliases')->insert([
                            'entity_id' => $entityId,
                            'alias' => $alias,
                            'alias_norm' => $aliasNorm,
                            'weight' => $weight,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            }
        });
    }

    private function upsertEntityCompany(string $company, string $symbol): int
    {
        $symbol = strtoupper(trim($symbol));

        $row = DB::table('stock_entities')
            ->where('type', 'company')
            ->where('symbol', $symbol)
            ->first();

        if ($row) {
            DB::table('stock_entities')
                ->where('id', $row->id)
                ->update([
                    'name' => $company,
                    'updated_at' => now(),
                ]);

            return (int)$row->id;
        }

        return (int) DB::table('stock_entities')->insertGetId([
            'type' => 'company',
            'symbol' => $symbol,
            'name' => $company,
            'priority' => 10, // bạn có thể customize theo popularity
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Normalize for search:
     * - lowercase
     * - trim
     * - collapse spaces
     * - keep alnum + space + & + . + - 
     */
    private function norm(string $s): string
    {
        $s = mb_strtolower(trim($s));
        $s = preg_replace('/\s+/', ' ', $s) ?? $s;
        $s = preg_replace('/[^a-z0-9 .&-]/', '', $s) ?? $s;
        return trim($s);
    }
}
