<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('instruments', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('symbol', length: 16)->unique();
            $table->string('name', 255);
            $table->enum('type', ['stock', 'bond', 'commodity', 'currency'])
                ->default('stock');
            $table->string('slug', 255)->unique();
            $table->string('exchange', 255)->nullable();
            $table->timestamps();           
            $table->softDeletes();   
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('instrument');
    }
};