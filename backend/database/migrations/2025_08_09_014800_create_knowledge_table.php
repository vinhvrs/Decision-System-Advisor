<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void 
    {
        Schema::create('knowledge', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('topic', 255);
            $table->string('content');
            $table->string('author', 100)->nullable();
            $table->string('url_slug')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->index(['topic', 'author']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge');
    }
};