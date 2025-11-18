<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void 
    {
        Schema::create('instrument_data', function (Blueprint $table){
            $table->uuid('id')->primary();
            $table->uuid('instrument_period_id');
            $table->uuid('timestamps');
            $table->decimal('open', 20, 10)->nullable();
            $table->decimal('high', 20, 10)->nullable();
            $table->decimal('low', 20, 10)->nullable();
            $table->decimal('close', 20, 10)->nullable();
            $table->unsignedBigInteger('volume')->nullable();
            $table->string('source')->nullable()->index();
            $table->string('slug');
            $table->timestamps(0); // Use 0 to avoid fractional seconds
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('instrument_data');
    }

};