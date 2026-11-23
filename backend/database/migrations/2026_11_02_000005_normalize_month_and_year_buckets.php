<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        // Some older monthly/yearly imports used the first TRADING day instead
        // of the calendar bucket label, duplicating the newer month/year imports.
        foreach ([['instrument_data', 'instrument_periods'], ['instrument_data_demo', 'instrument_period_demo']] as [$data, $periods]) {
            DB::statement('CREATE TEMPORARY TABLE dsa_duplicate_bucket_ids (id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY)');
            DB::statement("INSERT INTO dsa_duplicate_bucket_ids (id) SELECT id FROM (
                SELECT d.id, ROW_NUMBER() OVER (
                    PARTITION BY d.instrument_period_id,
                        CASE WHEN p.period='monthly' THEN DATE_FORMAT(d.timestamps,'%Y-%m-01') ELSE DATE_FORMAT(d.timestamps,'%Y-01-01') END
                    ORDER BY d.updated_at DESC, (DAY(d.timestamps)=1) DESC, d.id
                ) rn FROM `{$data}` d JOIN `{$periods}` p ON p.id=d.instrument_period_id
                WHERE p.period IN ('monthly','yearly')
            ) ranked WHERE rn>1");
            DB::delete("DELETE d FROM `{$data}` d JOIN dsa_duplicate_bucket_ids x ON x.id=d.id");
            DB::statement('DROP TEMPORARY TABLE dsa_duplicate_bucket_ids');
            DB::update("UPDATE `{$data}` d JOIN `{$periods}` p ON p.id=d.instrument_period_id
                SET d.timestamps=CAST(CASE WHEN p.period='monthly' THEN DATE_FORMAT(d.timestamps,'%Y-%m-01') ELSE DATE_FORMAT(d.timestamps,'%Y-01-01') END AS DATETIME)
                WHERE p.period IN ('monthly','yearly')");
        }
    }

    public function down(): void
    {
        // Restore the consistent SQL backup to recover the duplicate legacy buckets.
    }
};
