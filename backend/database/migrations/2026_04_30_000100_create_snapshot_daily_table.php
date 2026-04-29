<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('snapshot_daily', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('instrument_id')->index();
            $table->string('symbol', 16)->index();
            $table->json('candles');
            $table->unsignedInteger('candles_count')->default(0);
            $table->dateTime('from_time')->nullable()->index();
            $table->dateTime('to_time')->nullable()->index();
            $table->timestamps();

            $table->unique(['instrument_id', 'symbol'], 'uq_snapshot_daily_instrument_symbol');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('snapshot_daily');
    }
};

