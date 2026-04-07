<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add indexes for user_id, symbol, status on tickets table.
     * Skips if index already exists.
     */
    public function up(): void
    {
        $indexes = collect(DB::select("SHOW INDEX FROM tickets WHERE Key_name != 'PRIMARY'"));

        Schema::table('tickets', function (Blueprint $table) use ($indexes) {
            if (!$indexes->contains(fn ($i) => $i->Column_name === 'user_id')) {
                $table->index('user_id');
            }
            if (!$indexes->contains(fn ($i) => $i->Column_name === 'symbol')) {
                $table->index('symbol');
            }
            if (!$indexes->contains(fn ($i) => $i->Column_name === 'status')) {
                $table->index('status');
            }
        });
    }

    public function down(): void
    {
        $indexes = collect(DB::select("SHOW INDEX FROM tickets WHERE Key_name != 'PRIMARY'"));
        $names = $indexes->pluck('Key_name')->unique()->values();

        Schema::table('tickets', function (Blueprint $table) use ($names) {
            if ($names->contains('tickets_user_id_index')) {
                $table->dropIndex(['user_id']);
            }
            if ($names->contains('tickets_symbol_index')) {
                $table->dropIndex(['symbol']);
            }
            if ($names->contains('tickets_status_index')) {
                $table->dropIndex(['status']);
            }
        });
    }
};
