<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('news_articles',function(Blueprint $table) {
            $table->char('id',64)->primary();
            $table->text('url');
            $table->string('title',500);
            $table->string('publisher',255);
            $table->dateTime('published_at')->nullable();
            $table->string('status',24)->default('pending');
            $table->longText('body')->nullable();
            $table->unsignedInteger('word_count')->default(0);
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->string('parser',32)->nullable();
            $table->text('last_error')->nullable();
            $table->dateTime('last_attempt_at')->nullable();
            $table->dateTime('next_attempt_at')->nullable();
            $table->dateTime('extracted_at')->nullable();
            $table->timestamps();
            $table->index(['status','next_attempt_at']);
        });
        Schema::create('news_article_links',function(Blueprint $table) {
            $table->uuid('document_id')->primary();
            $table->char('article_id',64);
            $table->foreign('article_id')->references('id')->on('news_articles')->cascadeOnDelete();
        });
    }
    public function down(): void { Schema::dropIfExists('news_article_links');Schema::dropIfExists('news_articles'); }
};
