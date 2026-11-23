<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('economic_events', function (Blueprint $table) {
            $table->char('id', 64)->primary();
            $table->string('source', 24);
            $table->date('week_start');
            $table->string('title', 255);
            $table->string('currency', 3);
            $table->string('impact', 12);
            $table->dateTime('scheduled_at'); // UTC, preserves the provider's exact instant.
            $table->boolean('all_day')->default(false);
            $table->string('forecast', 100)->nullable();
            $table->string('previous', 100)->nullable();
            $table->string('actual', 100)->nullable(); // Not supplied by the weekly feed.
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->index(['source', 'week_start']);
            $table->index(['active', 'scheduled_at', 'currency'], 'economic_events_range');
        });
        Schema::create('economic_calendar_sync', function (Blueprint $table) {
            $table->string('source', 24)->primary();
            $table->dateTime('last_attempt_at')->nullable();
            $table->dateTime('last_success_at')->nullable();
            $table->dateTime('next_fetch_at')->nullable();
            $table->text('last_error')->nullable();
            $table->char('content_hash', 64)->nullable();
            $table->unsignedInteger('event_count')->default(0);
            $table->date('week_start')->nullable();
            $table->date('week_end')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('economic_events');
        Schema::dropIfExists('economic_calendar_sync');
    }
};
