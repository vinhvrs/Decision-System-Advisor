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
            $table->string('symbol', 16)->unique();
            
            // Đã gộp độ dài mới từ file alter
            $table->string('name', 500); 
            
            $table->enum('type', ['stock', 'bond', 'commodity', 'currency'])
                ->default('stock');
                
            // Đã gộp độ dài mới từ file alter
            $table->string('slug', 300)->unique(); 
            
            $table->string('exchange', 255)->nullable();
            
            $table->timestamps();           
            $table->softDeletes();   
        });
    }

    public function down(): void
    {
        // Đã sửa lỗi typo (thêm 's')
        Schema::dropIfExists('instruments'); 
    }
};