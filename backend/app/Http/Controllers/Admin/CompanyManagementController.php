<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class CompanyManagementController extends Controller
{
    public function index(Request $request)
    {
        $perPage = (int) $request->input('per_page', 15);
        $page = (int) $request->input('page', 1);
        $search = $request->input('search');

        $ttl = (int) config('performance.admin_list_ttl', 45);
        $cacheKey = 'admin.companies.index.v1:' . md5(serialize([$perPage, $page, (string) ($search ?? '')]));

        $payload = Cache::remember($cacheKey, max(1, $ttl), function () use ($perPage, $page, $search) {
            $query = DB::table('company_profile')->select([
                'company_profile.instrument_id',
                'company_profile.symbol',
                'company_profile.company_name',
                'company_profile.industry',
                'company_profile.sector',
                'company_profile.exchange',
                'company_profile.updated_at',
            ]);

            if ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('company_profile.symbol', 'like', "%{$search}%")
                        ->orWhere('company_profile.company_name', 'like', "%{$search}%");
                });
            }

            return $query->orderBy('company_profile.symbol')->paginate($perPage, ['*'], 'page', $page)->toArray();
        });

        return response()->json($payload);
    }

    public function show(string $symbol)
    {
        $company = DB::table('company_profile')->where('symbol', $symbol)->first();

        if (!$company) {
            return response()->json(['message' => 'Company not found'], 404);
        }
        return response()->json($company);
    }

    public function update(Request $request, string $symbol)
    {
        $validated = $request->validate([
            'company_name' => 'sometimes|string|max:255',
            'industry' => 'nullable|string|max:100',
            'sector' => 'nullable|string|max:100',
            'website' => 'nullable|url|max:500',
            'description' => 'nullable|string',
            'ceo' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
        ]);

        $updated = DB::table('company_profile')->where('symbol', $symbol)->update($validated);
        if ($updated === 0) {
            return response()->json(['message' => 'Company not found'], 404);
        }

        Cache::forget('admin.stats.most_watched.v1');

        $company = DB::table('company_profile')->where('symbol', $symbol)->first();
        return response()->json($company);
    }
}
