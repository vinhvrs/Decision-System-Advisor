<?php

namespace App\Support;

use Illuminate\Support\Facades\Schema;

/**
 * Column helpers when snapshot and company_profile schemas differ (demo vs production).
 */
final class SnapshotQuery
{
    public static function snapshotHasMarketCap(): bool
    {
        $table = DsaTables::name('instrument_snapshot');

        return Schema::hasTable($table) && Schema::hasColumn($table, 'market_cap');
    }

    /** SQL expression for market cap (snapshot column or company_profile fallback). */
    public static function marketCapExpr(string $snapshotAlias = 's', string $profileAlias = 'cp'): string
    {
        if (self::snapshotHasMarketCap()) {
            return "{$snapshotAlias}.market_cap";
        }

        $cpTable = DsaTables::name('company_profile');
        if (Schema::hasTable($cpTable) && Schema::hasColumn($cpTable, 'market_cap')) {
            return "{$profileAlias}.market_cap";
        }

        return 'NULL';
    }
}
