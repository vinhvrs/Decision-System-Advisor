<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('instrument_periods', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('instrument_id');
            $table->enum('period', ['1second', '5seconds', '10seconds', '30seconds', '1minute', '5minutes', '15minutes', '30minutes', '1hour', '2hour', '5hour', 'daily', 'weekly', 'monthly'])
                ->default('daily');
            $table->string('market', 50);
            $table->string('slug')->unique();
            $table->string('prefix')->nullable();
            $table->timestamps();
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('instrument_period');
    }
};