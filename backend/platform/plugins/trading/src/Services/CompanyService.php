<?php

namespace Platform\Plugins\Trading\Src\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class CompanyService
{
    public function __construct()
    {
        
    }

    public function getProfileBySymbol(string $symbol)
    {
        $company = DB::table('company_profile')
            ->where('symbol', $symbol)
            ->first();
        return $company;
    }

    public function getSimilar(string $symbol, int $limit){
        $sector = DB::table('company_profile')
            ->where('symbol', $symbol)
            ->select('sector')
            ->first();
            
        $companies = DB::table('company_profile')
            ->where('sector', $sector->sector)
            ->where('symbol', '!=', $symbol)
            ->limit($limit)
            ->get();
        
        return $companies;
    }

}
