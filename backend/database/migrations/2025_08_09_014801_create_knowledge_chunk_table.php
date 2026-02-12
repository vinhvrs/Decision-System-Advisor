<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('knowledge_chunks', function (Blueprint $table) {

            $table->uuid('id')->primary();

            $table->uuid('knowledge_id')->nullable();
            $table->uuid('docs_id');

            $table->integer('chunk_index');

            $table->text('content');
            $table->string('source', 255)->nullable();

            $table->integer('token')->default(0);
            $table->string('vector', 2000)->nullable();

            $table->json('data')->nullable();

            $table->timestamps();

            $table->foreign('docs_id')
                ->references('id')
                ->on('knowledge_docs')
                ->cascadeOnDelete();

            $table->foreign('knowledge_id')
                ->references('id')
                ->on('knowledge')
                ->nullOnDelete();

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