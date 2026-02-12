<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('instrument_snapshot', function (Blueprint $table) {
            $table->uuid('instrument_id')->primary();
            $table->string('symbol', 20)->index();
            $table->double('price');
            $table->double('open');
            $table->double('volume');
            $table->double('liquidity');
            $table->double('change_pct');
            $table->timestamp('updated_at')->index();
        });
        
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('instrument_snapshot');
    }
};
