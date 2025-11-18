<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration{

    public function up(): void
    {
        Schema::create('knowledge_docs', function(Blueprint $table){
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('content');
            $table->enum('category', ['article', 'report', 'manual'])->default('article');
            $table->string('source', 255)->nullable();
            $table->string('author', 100)->nullable();
            $table->string('language', 50)->default('en');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_docs');
    }

};