<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CompanyManagementController extends Controller
{
    public function index(Request $request)
    {
        $perPage = (int) $request->input('per_page', 15);
        $page = (int) $request->input('page', 1);
        $search = $request->input('search');

        $query = DB::table('company_profile')->select('company_profile.*');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('company_profile.symbol', 'like', "%{$search}%")
                    ->orWhere('company_profile.company_name', 'like', "%{$search}%");
            });
        }

        $companies = $query->orderBy('company_profile.symbol')->paginate($perPage, ['*'], 'page', $page);
        return response()->json($companies);
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

        $company = DB::table('company_profile')->where('symbol', $symbol)->first();
        return response()->json($company);
    }
}
