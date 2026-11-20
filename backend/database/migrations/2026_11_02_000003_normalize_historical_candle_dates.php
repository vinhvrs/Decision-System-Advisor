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
        // Backup is mandatory operationally before this migration. Old imports used
        // several clock times for the SAME daily candle, inflating aggregates/volume.
        foreach ([['instrument_data', 'instrument_periods'], ['instrument_data_demo', 'instrument_period_demo']] as [$data, $periods]) {
            DB::statement('CREATE TEMPORARY TABLE dsa_duplicate_candle_ids (id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY)');
            DB::statement("INSERT INTO dsa_duplicate_candle_ids (id)
                SELECT id FROM (
                    SELECT d.id, ROW_NUMBER() OVER (
                        PARTITION BY d.instrument_period_id, DATE(d.timestamps)
                        ORDER BY d.updated_at DESC, (TIME(CAST(d.timestamps AS DATETIME)) = '00:00:00') DESC, d.id
                    ) AS rn
                    FROM `{$data}` d JOIN `{$periods}` p ON p.id = d.instrument_period_id
                    WHERE p.period IN ('daily','weekly','monthly','yearly')
                ) ranked WHERE rn > 1");
            DB::delete("DELETE d FROM `{$data}` d JOIN dsa_duplicate_candle_ids x ON x.id = d.id");
            DB::statement('DROP TEMPORARY TABLE dsa_duplicate_candle_ids');
            DB::update("UPDATE `{$data}` d JOIN `{$periods}` p ON p.id = d.instrument_period_id
                SET d.timestamps = CAST(DATE(d.timestamps) AS DATETIME)
                WHERE p.period IN ('daily','weekly','monthly','yearly') AND TIME(CAST(d.timestamps AS DATETIME)) <> '00:00:00'");
        }
        DB::statement('ALTER TABLE instrument_data_demo MODIFY timestamps DATETIME NOT NULL');
    }

    public function down(): void
    {
        // Restore the pre-migration SQL backup to recover duplicate legacy imports.
    }
};
