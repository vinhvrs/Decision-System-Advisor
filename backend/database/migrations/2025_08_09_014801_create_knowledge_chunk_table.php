<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {

    public function up(): void
    {
        Schema::create('knowledge_chunks', function (Blueprint $table) {

            // Primary UUID
            $table->uuid('id')->primary();

            // Relation
            $table->uuid('knowledge_id')->nullable();
            $table->uuid('docs_id');

            $table->integer('chunk_index');

            // Content
            $table->longText('content');                 // <-- dùng longText
            $table->string('source', 255)->nullable();

            $table->integer('token')->default(0);

            // Vector (JSON string lưu embedding)
            $table->longText('vector')->nullable();      // <-- FIX: không dùng string(2000)

            // Extra metadata
            $table->json('data')->nullable();

            // Qdrant tracking
            $table->uuid('qdrant_point_id')->nullable()->index();
            $table->timestamp('qdrant_upserted_at')->nullable()->index();

            $table->timestamps();

            // Foreign keys
            $table->foreign('docs_id')
                ->references('id')
                ->on('knowledge_docs')
                ->cascadeOnDelete();

            $table->foreign('knowledge_id')
                ->references('id')
                ->on('knowledge')
                ->nullOnDelete();

            // Indexes
            $table->index('docs_id');
            $table->index('knowledge_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_chunks');
    }
};