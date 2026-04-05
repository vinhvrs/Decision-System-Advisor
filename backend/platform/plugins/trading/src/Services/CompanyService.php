<?php

namespace Platform\Plugins\Trading\Src\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CompanyService
{
    public function __construct() {}

    public function index($select, $filter, $perPage, $page)
    {
        $companies = DB::table('company_profile')
            ->select($select)
            ->where($filter)
            ->paginate($perPage, ['*'], 'page', $page);
        return $companies;
    }

    public function getProfileBySymbol(string $symbol)
    {
        $company = DB::table('company_profile')
            ->where('symbol', $symbol)
            ->first();
        return $company;
    }

    public function getSimilar(string $symbol, int $limit): Collection
    {
        $sector = DB::table('company_profile')
            ->where('symbol', $symbol)
            ->value('sector');

        return $this->similarInSector($sector, $symbol, $limit);
    }

    /**
     * @return Collection<int, \stdClass>
     */
    public function similarInSector(?string $sector, string $excludeSymbol, int $limit): Collection
    {
        if ($sector === null || $sector === '') {
            return collect();
        }

        return DB::table('company_profile')
            ->where('sector', $sector)
            ->where('symbol', '!=', $excludeSymbol)
            ->limit($limit)
            ->get();
    }

}
