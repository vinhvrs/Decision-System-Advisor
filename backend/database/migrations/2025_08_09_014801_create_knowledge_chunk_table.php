<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {

    public function up(): void
    {
        Schema::create('knowledge_chunks', function (Blueprint $table) {
            $table->uuid('id')->primary();

            // Relation duy nhất trỏ về docs thô
            $table->uuid('docs_id');
            $table->integer('chunk_index');

            // Content
            $table->longText('content');                 
            $table->integer('token')->default(0);

            // Extra metadata
            $table->json('data')->nullable();

            // Qdrant tracking (Đã gộp từ file migration riêng)
            $table->uuid('qdrant_point_id')->nullable()->index();
            $table->timestamp('qdrant_upserted_at')->nullable()->index();

            $table->timestamps();

            // Foreign keys
            $table->foreign('docs_id')
                ->references('id')
                ->on('knowledge_docs')
                ->cascadeOnDelete();

            // Indexes
            $table->index('docs_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_chunks');
    }
};