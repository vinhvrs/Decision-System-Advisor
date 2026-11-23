<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        foreach (['snapshot_demo','instrument_snapshot'] as $table) {
            if (Schema::hasTable($table)) Schema::table($table,function(Blueprint $t){
                $t->double('volume')->nullable()->change();
                $t->double('liquidity')->nullable()->change();
            });
        }
    }
    public function down(): void
    {
        // Do not invent zeros when rolling code back. Nullable observations remain compatible.
    }
};
