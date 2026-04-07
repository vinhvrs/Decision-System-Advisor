<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Trading tickets (positions).
     * real_value = price * leverage * volume
     * Buy:  P = (Current - Open) × (Volume × Leverage / Open)
     * Sell: P = (Open - Current) × (Volume × Leverage / Open)
     */
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->index();
            $table->enum('type', ['Buy', 'Sell']);
            $table->enum('market', ['stock', 'crypto', 'forex']);
            $table->string('symbol', 32)->index();
            $table->decimal('leverage', 12, 4)->default(1);
            $table->decimal('volume', 18, 8);
            $table->decimal('price', 18, 8);
            $table->enum('status', ['open', 'closed', 'cancelled'])->default('open')->index();
            $table->decimal('profit', 18, 8)->nullable();
            $table->timestamp('open')->nullable();
            $table->timestamp('close')->nullable();
            $table->timestamps();

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
