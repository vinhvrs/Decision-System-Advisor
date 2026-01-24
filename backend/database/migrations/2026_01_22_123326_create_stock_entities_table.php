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
        Schema::create('stock_entities', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20);          // company | indicator
            $table->string('symbol', 20)->nullable();
            $table->string('name', 255);
            $table->integer('priority')->default(0);
            $table->timestamps();

            $table->index(['type', 'symbol']);
            $table->index(['type', 'name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_entities');
    }
};
