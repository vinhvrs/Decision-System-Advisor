<?php
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('knowledge', function (Blueprint $table) {
            $table->uuid('id')
                ->default(DB::raw('(UUID())'))
                ->change();
        });
    }

    public function down(): void
    {
        Schema::table('knowledge', function (Blueprint $table) {
            $table->uuid('id')->change();
        });
    }
};
