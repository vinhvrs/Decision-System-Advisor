<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('knowledge_docs', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->string('title', 500);
            $table->longText('content')->nullable(); 
            $table->string('image', 1000)->nullable(); 

            $table->enum('category', ['article', 'report', 'manual'])->default('article');
            
            $table->string('symbol', 50)->nullable()->index(); 

            $table->string('source', 500)->unique();
            $table->string('author', 500)->nullable(); 
            $table->string('language', 50)->default('en');
            
            $table->tinyInteger('is_processed')->default(0); 

            $table->timestamps();

            // Các index phục vụ RAG và sort
            $table->index(['category', 'is_processed'], 'idx_docs_category_processed');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_docs');
    }
};