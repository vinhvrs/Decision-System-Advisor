<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // --------------------------
        // USERS & USERS_SLUG
        // --------------------------
        Schema::table('users_slug', function (Blueprint $table) {
            //$table->unique('user_id', 'uq_users_slug_user');

            // Slug global unique để dễ route
            $table->unique('slug', 'uq_users_slug_slug');

            // FK -> users
            $table->foreign('user_id', 'fk_users_slug_user')
                  ->references('id')->on('users')
                  ->onDelete('cascade');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unique('username', 'uq_users_username');
            $table->unique('email', 'uq_users_email');
            $table->unique('phone', 'uq_users_phone');
        });

        // --------------------------
        // HISTORY CHAT
        // --------------------------
        Schema::table('history', function (Blueprint $table) {
            $table->index(['user_id', 'created_at'], 'idx_history_user_created');
            $table->foreign('user_id', 'fk_history_user')
                  ->references('id')->on('users')
                  ->onDelete('cascade');  
        });

        // --------------------------
        // BILLING
        // --------------------------
        Schema::table('bills', function (Blueprint $table) {
            $table->index(['user_id', 'created_at'], 'idx_bills_user_created');
            $table->foreign('user_id', 'fk_bills_user')
                  ->references('id')->on('users')
                  ->onDelete('cascade');
        });

        Schema::table('payment', function (Blueprint $table) {
            $table->index('user_id', 'idx_payment_user');
            $table->foreign('user_id', 'fk_payment_user')
                  ->references('id')->on('users')
                  ->onDelete('cascade');
        });

        // --------------------------
        // INDICATORS (danh mục chỉ báo)
        // --------------------------
        Schema::table('indicators', function (Blueprint $table) {
            $table->unique('slug', 'uq_indicators_slug');
            $table->index('name', 'idx_indicators_name');
        });

        // --------------------------
        // INSTRUMENTS (symbol, exchange)
        // --------------------------
        Schema::table('instruments', function (Blueprint $table) {
            $table->unique(['symbol', 'exchange'], 'uq_instruments_symbol_ex');
            $table->unique('slug', 'uq_instruments_slug');
            $table->index('symbol', 'idx_instruments_symbol');
        });

        // --------------------------
        // INSTRUMENT_PERIODS
        // --------------------------
        Schema::table('instrument_periods', function (Blueprint $table) {
            // FK -> instruments
            $table->foreign('instrument_id', 'fk_periods_instrument')
                  ->references('id')->on('instruments')
                  ->onDelete('cascade');

            $table->unique(['instrument_id', 'period', 'market'], 'uq_periods_inst_tf_mt');
            $table->index(['instrument_id', 'period'], name: 'idx_periods_inst_tf');
        });

        // --------------------------
        // INSTRUMENT_DATA (OHLC time-series)
        // --------------------------
        Schema::table('instrument_data', function (Blueprint $table) {
            // FK -> instrument_periods
            $table->foreign('instrument_period_id', 'fk_data_period')
                  ->references('id')->on('instrument_periods')
                  ->onDelete('cascade');

            $table->unique(['instrument_period_id', 'timestamp'], 'uq_data_period_ts');

            $table->index('timestamp', 'idx_data_timestamp');
        });

        // --------------------------
        // KNOWLEDGE (FAQ/seed)
        // --------------------------
        Schema::table('knowledge', function (Blueprint $table) {
            $table->unique('slug', 'uq_knowledge_slug');
            $table->index('topic', 'idx_knowledge_topic');
        });

        // --------------------------
        // KNOWLEDGE_DOCS 
        // --------------------------
        Schema::table('knowledge_docs', function (Blueprint $table) {
            $table->index(['category', 'language'], 'idx_docs_category_lang');
            $table->index('created_at', 'idx_docs_created');
        });

        // --------------------------
        // KNOWLEDGE_CHUNKS
        // --------------------------
        Schema::table('knowledge_chunks', function (Blueprint $table) {
            $table->foreign('docs_id', 'fk_chunks_doc')
                  ->references('id')->on('knowledge_docs')
                  ->onDelete('cascade');

            $table->foreign('knowledge_id', 'fk_chunks_knowledge')
                  ->references('id')->on('knowledge')
                  ->onDelete('cascade');

            $table->unique(['docs_id', 'chunk_index'], 'uq_chunks_doc_index');

            $table->index('docs_id', 'idx_chunks_doc');
        });
    }


    public function down(): void
    {
        Schema::table('knowledge_chunks', function (Blueprint $table) {
            $table->dropForeign('fk_chunks_doc');
            // $table->dropForeign('fk_chunks_knowledge');
            $table->dropUnique('uq_chunks_doc_index');
            $table->dropIndex('idx_chunks_doc');
        });

        Schema::table('knowledge_docs', function (Blueprint $table) {
            $table->dropUnique('uq_docs_slug');
            $table->dropIndex('idx_docs_category_lang');
            $table->dropIndex('idx_docs_created');
        });

        Schema::table('knowledge', function (Blueprint $table) {
            $table->dropUnique('uq_knowledge_slug');
            $table->dropIndex('idx_knowledge_topic');
        });

        Schema::table('instrument_data', function (Blueprint $table) {
            $table->dropForeign('fk_data_period');
            $table->dropUnique('uq_data_period_ts');
            $table->dropIndex('idx_data_timestamp');
        });

        Schema::table('instrument_periods', function (Blueprint $table) {
            $table->dropForeign('fk_periods_instrument');
            $table->dropUnique('uq_periods_inst_tf_mt');
            $table->dropIndex('idx_periods_inst_tf');
        });

        Schema::table('instruments', function (Blueprint $table) {
            $table->dropUnique('uq_instruments_symbol_ex');
            $table->dropUnique('uq_instruments_slug');
            $table->dropIndex('idx_instruments_symbol');
        });

        Schema::table('indicators', function (Blueprint $table) {
            $table->dropUnique('uq_indicators_slug');
            $table->dropIndex('idx_indicators_name');
        });

        Schema::table('payment', function (Blueprint $table) {
            $table->dropForeign('fk_payment_user');
            $table->dropIndex('idx_payment_user');
        });

        Schema::table('bills', function (Blueprint $table) {
            $table->dropForeign('fk_bills_user');
            $table->dropIndex('idx_bills_user_created');
        });

        Schema::table('history', function (Blueprint $table) {
            $table->dropForeign('fk_history_user');
            $table->dropIndex('idx_history_user_created');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('uq_users_username');
            $table->dropUnique('uq_users_gmail');
            $table->dropUnique('uq_users_phone');
        });

        Schema::table('users_slug', function (Blueprint $table) {
            $table->dropForeign('fk_users_slug_user');
            $table->dropUnique('uq_users_slug_user');
            $table->dropUnique('uq_users_slug_slug');
        });
    }
};

