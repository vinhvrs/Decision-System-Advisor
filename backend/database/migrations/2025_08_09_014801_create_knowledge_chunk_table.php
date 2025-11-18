<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('knowledge_chunks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('knowledge_id');
            $table->uuid('docs_id')->nullable();
            $table->integer('chunk_index')->unsigned();
            $table->string('content');
            $table->string('source', 100)->nullable();
            $table->integer('token')->unsigned()->nullable();
            $table->string('vector', 255)->nullable();
            $table->json('data')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_chunks');
    }
};