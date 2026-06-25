<?php

namespace App\Services;

use App\Support\DsaTables;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Thesis / demo symbol universe (10 US tech names).
 * Symbol list source follows DEV_MODE table resolution for ``instruments``.
 */
class DemoSymbolService
{
    public const FIXED_TEN = [
        'AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'META', 'AMZN', 'IBM', 'ORCL', 'AVGO',
    ];

    /** @return list<string> */
    public function symbols(): array
    {
        $instrumentsTable = DsaTables::name('instruments');
        if (Schema::hasTable($instrumentsTable)) {
            $query = DB::table($instrumentsTable)->select('symbol');
            if (Schema::hasColumn($instrumentsTable, 'deleted_at')) {
                $query->whereNull('deleted_at');
            }
            $fromTable = $this->normalizeSymbols($query->orderBy('symbol')->pluck('symbol')->all());
            if ($fromTable !== []) {
                return $fromTable;
            }
        }

        $snapshotTable = DsaTables::name('instrument_snapshot');
        if (Schema::hasTable($snapshotTable)) {
            $fromSnapshot = $this->normalizeSymbols(
                DB::table($snapshotTable)
                    ->orderByDesc('volume')
                    ->limit(10)
                    ->pluck('symbol')
                    ->all()
            );
            if ($fromSnapshot !== []) {
                return $fromSnapshot;
            }
        }

        return self::FIXED_TEN;
    }

    public function isDemoSymbol(string $symbol): bool
    {
        $sym = strtoupper(trim($symbol));

        return $sym !== '' && in_array($sym, $this->symbols(), true);
    }

    /** @param  list<mixed>  $raw */
    private function normalizeSymbols(array $raw): array
    {
        $out = [];
        foreach ($raw as $s) {
            $sym = strtoupper(trim((string) $s));
            if ($sym !== '' && ! in_array($sym, $out, true)) {
                $out[] = $sym;
            }
        }

        return $out;
    }
}
