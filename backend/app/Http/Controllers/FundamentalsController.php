<?php

namespace App\Http\Controllers;

use App\Models\CompanyFiling;
use App\Models\FinancialMetricAnnual;
use App\Models\FinancialMetricQuarterly;
use App\Models\FundamentalIssuerProfile;
use App\Models\FundamentalScore;
use App\Support\DsaTables;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class FundamentalsController extends Controller
{
    /** US tech universe for fast screener (matches python fundamental_ingest). */
    public const SCREENER_SYMBOLS = [
        'AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'META', 'AMZN', 'IBM', 'ORCL', 'AVGO',
    ];

    private function normalizeSymbol(string $symbol): string
    {
        $s = strtoupper(preg_replace('/[^A-Za-z]/', '', $symbol));

        return strlen($s) <= 12 ? $s : substr($s, 0, 12);
    }

    /**
     * Market quotes from the resolved snapshot table (``DEV_MODE``).
     *
     * @param  list<string>  $symbols
     * @return array<string, object>
     */
    private function loadMarketSnapshots(array $symbols): array
    {
        $snapBySym = [];
        $placeholders = implode(',', array_fill(0, count($symbols), '?'));
        $snapTable = DsaTables::name('instrument_snapshot');

        if (! Schema::hasTable($snapTable)) {
            return $snapBySym;
        }

        $snapCols = ['symbol', 'price', 'change_pct', 'volume', 'liquidity'];
        if (Schema::hasColumn($snapTable, 'open')) {
            $snapCols[] = 'open';
        }
        if (Schema::hasColumn($snapTable, 'market_cap')) {
            $snapCols[] = 'market_cap';
        }
        if (Schema::hasColumn($snapTable, 'updated_at')) {
            $snapCols[] = 'updated_at';
        }

        $rows = DB::table($snapTable)
            ->whereRaw("UPPER(TRIM(symbol)) IN ({$placeholders})", $symbols)
            ->get($snapCols);
        foreach ($rows as $r) {
            $sym = strtoupper(trim((string) $r->symbol));
            $snapBySym[$sym] = $r;
        }

        return $snapBySym;
    }

    /**
     * Latest SEC fetch time per symbol from ``company_facts_raw``.
     *
     * @param  list<string>  $symbols
     * @return array<string, string|null>
     */
    private function secFetchedAtBySymbol(array $symbols): array
    {
        if (! Schema::hasTable('company_facts_raw')) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($symbols), '?'));
        $rows = DB::table('company_facts_raw')
            ->selectRaw('UPPER(TRIM(symbol)) AS symbol, MAX(fetched_at) AS fetched_at')
            ->whereRaw("UPPER(TRIM(symbol)) IN ({$placeholders})", $symbols)
            ->groupBy(DB::raw('UPPER(TRIM(symbol))'))
            ->get();

        $out = [];
        foreach ($rows as $r) {
            $sym = strtoupper(trim((string) $r->symbol));
            $out[$sym] = $r->fetched_at ? (string) $r->fetched_at : null;
        }

        return $out;
    }

    /**
     * One-shot screener payload for the fixed 10-symbol universe (market + SEC fundamentals).
     */
    public function screener()
    {
        $symbols = self::SCREENER_SYMBOLS;
        $snapBySym = $this->loadMarketSnapshots($symbols);

        $cpBySym = [];
        $cpTable = DsaTables::name('company_profile');
        if (Schema::hasTable($cpTable)) {
            $cpCols = ['symbol', 'company_name'];
            if (Schema::hasColumn($cpTable, 'market_cap')) {
                $cpCols[] = 'market_cap';
            }
            if (Schema::hasColumn($cpTable, 'image')) {
                $cpCols[] = 'image';
            }
            $cpPlaceholders = implode(',', array_fill(0, count($symbols), '?'));
            $cpRows = DB::table($cpTable)
                ->whereRaw("UPPER(TRIM(symbol)) IN ({$cpPlaceholders})", $symbols)
                ->get($cpCols);
            foreach ($cpRows as $r) {
                $sym = strtoupper(trim((string) $r->symbol));
                if (! isset($cpBySym[$sym])) {
                    $cpBySym[$sym] = $r;
                }
            }
        }

        $annualBySym = [];
        foreach ($symbols as $sym) {
            $row = FinancialMetricAnnual::query()
                ->where('symbol', $sym)
                ->orderByDesc('fiscal_year')
                ->first();
            if ($row) {
                $annualBySym[$sym] = $row;
            }
        }

        $scores = FundamentalScore::query()->whereIn('symbol', $symbols)->get()->keyBy('symbol');
        $issuers = FundamentalIssuerProfile::query()->whereIn('symbol', $symbols)->get()->keyBy('symbol');
        $secFetched = $this->secFetchedAtBySymbol($symbols);

        $rows = [];
        foreach ($symbols as $sym) {
            $snap = $snapBySym[$sym] ?? null;
            $cp = $cpBySym[$sym] ?? null;
            $annual = $annualBySym[$sym] ?? null;
            $score = $scores->get($sym);
            $issuer = $issuers->get($sym);

            $price = $snap ? (float) $snap->price : 0.0;
            $eps = $annual && $annual->eps_diluted !== null ? (float) $annual->eps_diluted : null;
            $equity = $annual && $annual->equity !== null ? (float) $annual->equity : null;
            $shares = $annual && $annual->shares_outstanding !== null ? (float) $annual->shares_outstanding : null;
            $mktCap = null;
            if ($cp && property_exists($cp, 'market_cap') && $cp->market_cap !== null) {
                $mktCap = (float) $cp->market_cap;
            } elseif ($snap && property_exists($snap, 'market_cap') && $snap->market_cap !== null) {
                $mktCap = (float) $snap->market_cap;
            }

            $pe = null;
            if ($price > 0 && $eps !== null && $eps > 0) {
                $pe = $price / $eps;
            } elseif ($mktCap !== null && $mktCap > 0 && $annual && $annual->net_income !== null && (float) $annual->net_income > 0) {
                $pe = $mktCap / (float) $annual->net_income;
            }

            $pb = null;
            if ($equity !== null && $equity > 0) {
                if ($mktCap !== null && $mktCap > 0) {
                    $pb = $mktCap / $equity;
                } elseif ($price > 0 && $shares !== null && $shares > 0) {
                    $pb = ($price * $shares) / $equity;
                }
            }

            $rows[] = [
                'symbol' => $sym,
                'company_name' => $cp->company_name ?? $issuer->company_name ?? $sym,
                'logo_url' => ($cp && property_exists($cp, 'image')) ? $cp->image : null,
                'price' => $price > 0 ? round($price, 4) : null,
                'change_pct' => $snap ? round((float) $snap->change_pct, 2) : null,
                'volume' => $snap ? (float) $snap->volume : null,
                'liquidity' => $snap ? (float) $snap->liquidity : null,
                'market_cap' => $mktCap !== null ? round($mktCap, 2) : null,
                'fiscal_year' => $annual?->fiscal_year,
                'revenue' => $annual?->revenue !== null ? (float) $annual->revenue : null,
                'net_income' => $annual?->net_income !== null ? (float) $annual->net_income : null,
                'roe' => $annual?->roe !== null ? (float) $annual->roe : null,
                'debt_equity' => $annual?->debt_equity !== null ? (float) $annual->debt_equity : null,
                'pe_ratio' => $pe !== null ? round($pe, 2) : null,
                'pb_ratio' => $pb !== null ? round($pb, 2) : null,
                'overall_score' => $score?->overall_score !== null ? (float) $score->overall_score : null,
                'filing_date' => $annual?->filing_date?->format('Y-m-d'),
                'fundamentals_updated_at' => $annual?->updated_at,
                'sec_fetched_at' => $secFetched[$sym] ?? null,
                'market_updated_at' => ($snap && isset($snap->updated_at)) ? (string) $snap->updated_at : null,
            ];
        }

        return response()->json([
            'data' => [
                'symbols' => $symbols,
                'rows' => $rows,
                'updated_at' => now()->toIso8601String(),
            ],
        ]);
    }

    public function show(string $symbol)
    {
        $sym = $this->normalizeSymbol($symbol);
        if ($sym === '') {
            return response()->json(['message' => 'Invalid symbol'], 422);
        }

        $score = FundamentalScore::query()->where('symbol', $sym)->first();
        $issuer = FundamentalIssuerProfile::query()->where('symbol', $sym)->first();
        $latestAnnual = FinancialMetricAnnual::query()
            ->where('symbol', $sym)
            ->orderByDesc('fiscal_year')
            ->first();

        $annualCount = FinancialMetricAnnual::query()->where('symbol', $sym)->count();
        $quarterlyCount = FinancialMetricQuarterly::query()->where('symbol', $sym)->count();
        $filingsCount = CompanyFiling::query()->where('symbol', $sym)->count();
        $latestFilingDate = CompanyFiling::query()->where('symbol', $sym)->max('filing_date');

        $updatedAt = collect([
            $score?->updated_at,
            $latestAnnual?->updated_at,
            $issuer?->updated_at,
        ])->filter()->max();

        return response()->json([
            'data' => [
                'symbol' => $sym,
                'issuer' => $issuer,
                'score' => $score,
                'latest_annual' => $latestAnnual,
                'counts' => [
                    'annual' => $annualCount,
                    'quarterly' => $quarterlyCount,
                    'filings' => $filingsCount,
                ],
                'latest_filing_date' => $latestFilingDate,
                'updated_at' => $updatedAt,
            ],
        ]);
    }

    public function annual(string $symbol, Request $request)
    {
        $sym = $this->normalizeSymbol($symbol);
        $limit = min(30, max(1, (int) $request->query('limit', 15)));

        $rows = FinancialMetricAnnual::query()
            ->where('symbol', $sym)
            ->orderByDesc('fiscal_year')
            ->limit($limit)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function quarterly(string $symbol, Request $request)
    {
        $sym = $this->normalizeSymbol($symbol);
        $limit = min(60, max(1, (int) $request->query('limit', 24)));

        $rows = FinancialMetricQuarterly::query()
            ->where('symbol', $sym)
            ->orderByDesc('fiscal_year')
            ->orderByDesc('fiscal_quarter')
            ->limit($limit)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function score(string $symbol)
    {
        $sym = $this->normalizeSymbol($symbol);
        $row = FundamentalScore::query()->where('symbol', $sym)->first();
        if (! $row) {
            return response()->json(['message' => 'No fundamental score yet for this symbol.'], 404);
        }

        return response()->json(['data' => $row]);
    }

    public function filings(string $symbol, Request $request)
    {
        $sym = $this->normalizeSymbol($symbol);
        $limit = min(200, max(1, (int) $request->query('limit', 80)));

        $rows = CompanyFiling::query()
            ->where('symbol', $sym)
            ->orderByDesc('filing_date')
            ->limit($limit)
            ->get();

        return response()->json(['data' => $rows]);
    }
}
