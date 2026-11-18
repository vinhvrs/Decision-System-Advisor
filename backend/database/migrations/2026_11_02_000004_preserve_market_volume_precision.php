<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            foreach (['instrument_data', 'instrument_data_demo'] as $table) {
                DB::statement("ALTER TABLE `{$table}` MODIFY volume DECIMAL(28,8) NULL");
            }
        }
    }

    public function down(): void
    {
        // Preserve fractional volume; narrowing back to BIGINT would discard data.
    }
};
