<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Speeds up filter[symbol]=X style queries (slug LIKE 'x-%').
     */
    public function up(): void
    {
        Schema::table('instrument_data', function (Blueprint $table) {
            $table->index('slug', 'idx_instrument_data_slug');
        });
    }

    public function down(): void
    {
        Schema::table('instrument_data', function (Blueprint $table) {
            $table->dropIndex('idx_instrument_data_slug');
        });
    }
};
