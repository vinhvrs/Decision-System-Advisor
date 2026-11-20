<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Each removed key has an equivalent key which remains in the same table.
    private array $keys = [
        'instrument_data_v0' => [
            'idx_data_period_ts' => ['instrument_period_id', 'timestamps'],
            'idx_data_period_time' => ['instrument_period_id', 'timestamps'],
            'idx_period_time' => ['instrument_period_id', 'timestamps'],
        ],
        'instrument_data' => ['idx_fix_period_ts' => ['instrument_period_id', 'timestamps']],
        'instrument_periods' => [
            'idx_slug_period_unique' => ['slug'],
            'idx_period_instrument' => ['instrument_id', 'period'],
            'idx_period_name' => ['period'],
        ],
    ];

    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        foreach ($this->keys as $table => $keys) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            $clauses = [];
            foreach ($keys as $name => $columns) {
                if (Schema::hasIndex($table, $name)) {
                    $clauses[] = "DROP INDEX `{$name}`";
                }
            }
            if ($clauses !== []) {
                DB::statement('ALTER TABLE `'.$table.'` '.implode(', ', $clauses).', ALGORITHM=INPLACE, LOCK=NONE');
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        foreach ($this->keys as $table => $keys) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            foreach ($keys as $name => $columns) {
                if (! Schema::hasIndex($table, $name)) {
                    $kind = $name === 'idx_slug_period_unique' ? 'UNIQUE INDEX' : 'INDEX';
                    $cols = '`'.implode('`, `', $columns).'`';
                    DB::statement("ALTER TABLE `{$table}` ADD {$kind} `{$name}` ({$cols})");
                }
            }
        }
    }
};
