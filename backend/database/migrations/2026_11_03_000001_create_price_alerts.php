<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('price_alerts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('symbol', 16);
            $table->string('direction', 8); // above/below, inclusive thresholds
            $table->decimal('target_price', 28, 10);
            $table->string('status', 12)->default('active');
            $table->decimal('trigger_price', 28, 10)->nullable();
            $table->dateTime('source_at')->nullable();
            $table->dateTime('triggered_at')->nullable();
            $table->dateTime('read_at')->nullable();
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'created_at']);
            $table->index(['status', 'symbol']);
        });
    }
    public function down(): void { Schema::dropIfExists('price_alerts'); }
};
