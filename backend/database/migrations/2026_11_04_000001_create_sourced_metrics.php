<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('data_sources', function (Blueprint $t) {
            $t->string('code', 32)->primary(); $t->string('display_name', 128);
            $t->string('base_url', 512)->nullable(); $t->string('auth_type', 32)->default('NONE');
            $t->boolean('enabled')->default(false); $t->integer('priority')->default(100); $t->timestamps();
        });
        Schema::create('instrument_source_mappings', function (Blueprint $t) {
            $t->id(); $t->string('instrument_id', 36); $t->string('source_code', 32);
            $t->string('source_symbol', 128); $t->string('source_type', 64)->nullable();
            $t->boolean('is_primary')->default(false); $t->json('metadata_json')->nullable();
            $t->unique(['instrument_id', 'source_code'], 'uq_instrument_source');
        });
        Schema::create('instrument_benchmarks', function (Blueprint $t) {
            $t->string('instrument_id', 36)->primary(); $t->string('benchmark_instrument_id', 36)->nullable();
            $t->string('benchmark_source_symbol', 128)->nullable(); $t->string('reason')->nullable(); $t->timestamp('updated_at')->nullable();
        });
        Schema::create('metric_snapshots', function (Blueprint $t) {
            $t->id(); $t->string('instrument_id', 36); $t->string('timeframe', 16); $t->dateTime('observed_at');
            $t->string('metric_code', 64); $t->double('metric_value')->nullable(); $t->string('source_code', 32);
            $t->string('quality', 32); $t->json('metadata_json')->nullable(); $t->timestamp('created_at')->nullable();
            $t->unique(['instrument_id', 'timeframe', 'observed_at', 'metric_code'], 'uq_metric');
        });
        Schema::create('metric_refresh_state', function (Blueprint $t) {
            $t->string('instrument_id', 36); $t->string('timeframe', 16); $t->char('input_hash', 64);
            $t->dateTime('observed_at'); $t->timestamp('computed_at'); $t->json('provenance_json');
            $t->primary(['instrument_id', 'timeframe']);
        });
        Schema::create('fundamental_facts', function (Blueprint $t) {
            $t->id(); $t->char('identity_hash', 64)->unique(); $t->string('instrument_id', 36)->index();
            $t->string('metric_code', 64); $t->string('taxonomy', 32); $t->string('source_tag', 128); $t->string('unit', 32);
            $t->double('value')->nullable(); $t->date('period_start')->nullable(); $t->date('period_end');
            $t->string('fiscal_year', 16)->nullable(); $t->string('fiscal_period', 16)->nullable(); $t->string('form', 16);
            $t->date('filed_at')->nullable(); $t->string('accession', 64); $t->string('source_code', 32); $t->string('quality', 32);
            $t->timestamp('retrieved_at'); $t->index(['instrument_id', 'metric_code', 'period_end'], 'idx_facts_period');
        });
        Schema::create('macro_observations', function (Blueprint $t) {
            $t->id(); $t->char('identity_hash', 64)->unique(); $t->string('series_code', 64);
            $t->date('observed_at'); $t->double('value')->nullable(); $t->string('source_code', 32);
            $t->date('revision_at')->nullable(); $t->string('quality', 32); $t->json('metadata_json'); $t->timestamp('retrieved_at');
            $t->index(['source_code', 'series_code', 'observed_at'], 'idx_macro_series');
        });
        Schema::create('cot_positions', function (Blueprint $t) {
            $t->id(); $t->string('cftc_contract_code', 32); $t->string('report_type', 32); $t->date('report_date');
            $t->string('category', 64);
            foreach (['long_positions', 'short_positions', 'spread_positions', 'open_interest', 'net_positions', 'net_pct_oi'] as $c) $t->double($c)->nullable();
            $t->json('metadata_json'); $t->timestamp('retrieved_at');
            $t->unique(['cftc_contract_code', 'report_type', 'report_date', 'category'], 'uq_cot');
        });
        Schema::create('context_observations', function (Blueprint $t) {
            $t->id(); $t->char('identity_hash', 64)->unique(); $t->string('symbol', 16)->default('GLOBAL');
            $t->string('source_code', 32); $t->string('metric_code', 64); $t->dateTime('observed_at');
            $t->double('value')->nullable(); $t->string('quality', 32); $t->json('metadata_json'); $t->timestamp('retrieved_at');
            $t->index(['symbol', 'metric_code', 'observed_at'], 'idx_context');
        });
        Schema::create('source_health', function (Blueprint $t) {
            $t->string('source_code', 32)->primary(); $t->string('status', 32);
            foreach (['last_attempt_at', 'last_success_at', 'last_data_at'] as $c) $t->dateTime($c)->nullable();
            $t->integer('latency_ms')->nullable(); $t->integer('http_status')->nullable();
            $t->integer('consecutive_failures')->default(0); $t->text('last_error')->nullable();
            $t->json('metadata_json')->nullable(); $t->timestamp('updated_at')->nullable();
        });
        Schema::create('source_refresh_state', function (Blueprint $t) {
            $t->string('source_code', 32); $t->string('scope', 64); $t->string('watermark', 128)->nullable();
            $t->dateTime('last_checked_at'); $t->json('metadata_json')->nullable(); $t->primary(['source_code', 'scope']);
        });
    }

    public function down(): void
    {
        foreach (['source_refresh_state', 'source_health', 'context_observations', 'cot_positions', 'macro_observations', 'fundamental_facts', 'metric_refresh_state', 'metric_snapshots', 'instrument_benchmarks', 'instrument_source_mappings', 'data_sources'] as $table) Schema::dropIfExists($table);
    }
};
