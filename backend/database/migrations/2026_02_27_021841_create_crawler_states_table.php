<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crawler_states', function (Blueprint $table) {

            // Primary key UUID
            $table->char('id', 36)->primary();

            // Nguồn crawl (yahoo_rss, sec_api, investing, ...)
            $table->string('source', 100);

            // Symbol (AAPL, NVDA...)
            $table->string('symbol', 10);

            // Checkpoint theo thời gian (incremental crawl)
            $table->timestamp('last_published_at')->nullable();

            // Optional: GUID cuối cùng đã xử lý (RSS)
            $table->string('last_guid', 500)->nullable();

            // Theo dõi lỗi
            $table->unsignedInteger('fail_count')->default(0);
            $table->text('last_error')->nullable();

            // Lần chạy gần nhất
            $table->timestamp('last_run_at')->nullable();

            $table->timestamps();

            // 1 source + 1 symbol chỉ có 1 state
            $table->unique(['source', 'symbol']);

            // Index hỗ trợ query nhanh
            $table->index(['symbol']);
            $table->index(['source']);
            $table->index(['last_run_at']);
            $table->timestamp('locked_until')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crawler_states');
    }
};