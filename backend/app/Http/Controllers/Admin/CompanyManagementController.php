<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\DemoSymbolService;
use App\Support\DsaTables;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class CompanyManagementController extends Controller
{
    public function __construct(private readonly DemoSymbolService $demoSymbols)
    {
    }

    public function index(Request $request)
    {
        $perPage = (int) $request->input('per_page', 15);
        $page = (int) $request->input('page', 1);
        $search = $request->input('search');
        $demoList = $this->demoSymbols->symbols();

        $ttl = (int) config('performance.admin_list_ttl', 45);
        $cacheKey = 'admin.companies.index.v3:' . md5(serialize([$perPage, $page, (string) ($search ?? ''), $demoList]));

        $payload = Cache::remember($cacheKey, max(1, $ttl), function () use ($perPage, $page, $search, $demoList) {
            $profileTable = DsaTables::name('company_profile');
            $query = DB::table($profileTable)->select([
                "{$profileTable}.instrument_id",
                "{$profileTable}.symbol",
                "{$profileTable}.company_name",
                "{$profileTable}.industry",
                "{$profileTable}.sector",
                "{$profileTable}.exchange",
                "{$profileTable}.updated_at",
            ]);

            $query->whereIn(DB::raw("UPPER(TRIM({$profileTable}.symbol))"), $demoList);

            if ($search) {
                $query->where(function ($q) use ($search, $profileTable) {
                    $q->where("{$profileTable}.symbol", 'like', "%{$search}%")
                        ->orWhere("{$profileTable}.company_name", 'like', "%{$search}%");
                });
            }

            $rows = $query
                ->orderBy("{$profileTable}.symbol")
                ->orderByDesc("{$profileTable}.updated_at")
                ->get();

            /** One row per symbol (latest profile wins when duplicates exist). */
            $bySymbol = [];
            foreach ($rows as $row) {
                $sym = strtoupper(trim((string) $row->symbol));
                if ($sym === '' || isset($bySymbol[$sym])) {
                    continue;
                }
                $bySymbol[$sym] = $row;
            }

            $items = array_values($bySymbol);
            usort($items, fn ($a, $b) => strcmp((string) $a->symbol, (string) $b->symbol));

            $total = count($items);
            $perPage = max(1, $perPage);
            $lastPage = max(1, (int) ceil($total / $perPage));
            $page = min(max(1, $page), $lastPage);
            $offset = ($page - 1) * $perPage;
            $slice = array_slice($items, $offset, $perPage);

            return [
                'current_page' => $page,
                'data' => $slice,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
            ];
        });

        return response()->json(array_merge($payload, [
            'demo_symbols' => $demoList,
            'demo_only' => true,
        ]));
    }

    public function show(string $symbol)
    {
        if (! $this->demoSymbols->isDemoSymbol($symbol)) {
            return response()->json(['message' => 'Company not in demo universe'], 404);
        }

        $company = DB::table(DsaTables::name('company_profile'))->where('symbol', $symbol)->first();

        if (!$company) {
            return response()->json(['message' => 'Company not found'], 404);
        }
        return response()->json($company);
    }

    public function update(Request $request, string $symbol)
    {
        if (! $this->demoSymbols->isDemoSymbol($symbol)) {
            return response()->json(['message' => 'Company not in demo universe'], 404);
        }

        $validated = $request->validate([
            'company_name' => 'sometimes|string|max:255',
            'industry' => 'nullable|string|max:100',
            'sector' => 'nullable|string|max:100',
            'website' => 'nullable|url|max:500',
            'description' => 'nullable|string',
            'ceo' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
        ]);

        $updated = DB::table(DsaTables::name('company_profile'))->where('symbol', $symbol)->update($validated);
        if ($updated === 0) {
            return response()->json(['message' => 'Company not found'], 404);
        }

        Cache::forget('admin.stats.most_watched.v1');

        $company = DB::table(DsaTables::name('company_profile'))->where('symbol', $symbol)->first();
        return response()->json($company);
    }
}
