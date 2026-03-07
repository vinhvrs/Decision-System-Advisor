<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('knowledge', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('topic', 500);
            $table->text('content');
            
            // Chứa danh sách mảng JSON các UUID từ bảng knowledge_docs
            $table->json('source_docs_ids')->nullable(); 

            $table->string('author', 100)->nullable();
            $table->string('url_slug', 500)->nullable();
            
            // Đã sửa thành timestamp
            $table->timestamp('published_at')->nullable();

            $table->timestamps();

            $table->index('published_at');
            $table->index('topic');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge');
    }
};