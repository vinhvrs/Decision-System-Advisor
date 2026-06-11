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
        $sym = strtoupper(trim($symbol));

        $company = DB::table('company_profile as cp')
            ->leftJoin('instrument_snapshot as s', function ($join) {
                $join->on(DB::raw('UPPER(s.symbol)'), '=', DB::raw('UPPER(cp.symbol)'));
            })
            ->whereRaw('UPPER(cp.symbol) = ?', [$sym])
            ->select([
                'cp.*',
                's.price as snapshot_price',
                's.volume as snapshot_volume',
                's.liquidity as snapshot_liquidity',
                's.market_cap as market_cap',
                's.change_pct as snapshot_change_pct',
                's.updated_at as snapshot_updated_at',
            ])
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

        return DB::table('company_profile as cp')
            ->leftJoin('instrument_snapshot as s', function ($join) {
                $join->on(DB::raw('UPPER(s.symbol)'), '=', DB::raw('UPPER(cp.symbol)'));
            })
            ->where('cp.sector', $sector)
            ->whereRaw('UPPER(cp.symbol) != ?', [strtoupper(trim($excludeSymbol))])
            ->select([
                'cp.*',
                's.price as snapshot_price',
                's.volume as snapshot_volume',
                's.liquidity as snapshot_liquidity',
                's.market_cap as market_cap',
                's.change_pct as snapshot_change_pct',
                's.updated_at as snapshot_updated_at',
            ])
            ->limit($limit)
            ->get();
    }

}
