<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('market_assets')) Schema::create('market_assets', function (Blueprint $table) {
            $table->id();
            $table->string('instrument_id', 36)->unique();
            $table->string('symbol', 16)->unique();
            $table->string('market', 16)->index();
            $table->string('timezone', 64);
            $table->unsignedTinyInteger('session_roll_hour')->default(0);
            $table->string('provider', 16)->default('yahoo');
            $table->boolean('enabled')->default(true);
            $table->dateTime('last_bar_at')->nullable();
            $table->dateTime('last_sync_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
        });
        if (! Schema::hasTable('market_bars_30m')) Schema::create('market_bars_30m', function (Blueprint $table) {
            $table->unsignedBigInteger('asset_id');
            // UTC start of a completed 30-minute bar. The compact composite key is also the range index.
            $table->dateTime('open_time');
            foreach (['open', 'high', 'low', 'close'] as $field) {
                $table->decimal($field, 20, 10);
            }
            $table->decimal('volume', 28, 8)->nullable();
            $table->binary('content_hash', 16, true);
            $table->primary(['asset_id', 'open_time']);
            $table->foreign('asset_id')->references('id')->on('market_assets')->cascadeOnDelete();
        });
        if (! Schema::hasTable('market_rollup_state')) Schema::create('market_rollup_state', function (Blueprint $table) {
            $table->unsignedBigInteger('asset_id');
            $table->string('target', 32);
            $table->string('period', 12);
            // Trading/session date labels, not UTC instants (30m instants live in market_bars_30m).
            $table->date('bucket_date');
            $table->binary('content_hash', 16, true);
            $table->unsignedInteger('child_count');
            $table->boolean('is_final')->default(false);
            $table->boolean('coverage_partial')->default(true);
            $table->timestamp('updated_at')->nullable();
            $table->primary(['asset_id', 'target', 'period', 'bucket_date'], 'pk_market_rollup');
            $table->foreign('asset_id')->references('id')->on('market_assets')->cascadeOnDelete();
        });
        if (DB::getDriverName() === 'mysql') {
            foreach (['instruments', 'instrument_demo'] as $table) {
                DB::statement("ALTER TABLE `{$table}` MODIFY `type` ENUM('stock','bond','commodity','currency','etf','crypto','forex','index') NOT NULL DEFAULT 'stock'");
            }
            // Cast timestamps only AFTER calendar-date deduplication in migration 000003.
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('market_rollup_state');
        Schema::dropIfExists('market_bars_30m');
        Schema::dropIfExists('market_assets');
        // Retain the backwards-compatible wider type enum and DATETIME representation.
    }
};
