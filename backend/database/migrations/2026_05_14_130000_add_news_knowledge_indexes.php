<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Performance indexes for news / RAG paths on knowledge_docs and knowledge_chunks.
 * Safe to re-run: skips indexes that already exist (MySQL information_schema).
 */
return new class extends Migration
{
    private function indexExists(string $table, string $indexName): bool
    {
        if (! Schema::hasTable($table)) {
            return false;
        }
        $db = Schema::getConnection()->getDatabaseName();

        return (int) DB::table('information_schema.statistics')
            ->where('table_schema', $db)
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->count() > 0;
    }

    public function up(): void
    {
        if (Schema::hasTable('knowledge_docs')) {
            Schema::table('knowledge_docs', function (Blueprint $table) {
                if (! $this->indexExists('knowledge_docs', 'idx_kd_sym_pub')) {
                    if (Schema::hasColumn('knowledge_docs', 'published_at')) {
                        $table->index(['symbol', 'published_at'], 'idx_kd_sym_pub');
                    }
                }
                if (! $this->indexExists('knowledge_docs', 'idx_kd_pub_desc')) {
                    if (Schema::hasColumn('knowledge_docs', 'published_at')) {
                        $table->index(['published_at'], 'idx_kd_pub_desc');
                    }
                }
                if (! $this->indexExists('knowledge_docs', 'idx_kd_hash')) {
                    if (Schema::hasColumn('knowledge_docs', 'hash_key')) {
                        $table->index(['hash_key'], 'idx_kd_hash');
                    }
                }
                if (! $this->indexExists('knowledge_docs', 'idx_kd_cat_proc_created')) {
                    $table->index(['category', 'is_processed', 'created_at'], 'idx_kd_cat_proc_created');
                }
                if (! $this->indexExists('knowledge_docs', 'idx_kd_sym_proc')) {
                    $table->index(['symbol', 'is_processed'], 'idx_kd_sym_proc');
                }
            });
        }

        if (Schema::hasTable('knowledge_chunks')) {
            Schema::table('knowledge_chunks', function (Blueprint $table) {
                if (! $this->indexExists('knowledge_chunks', 'idx_kc_doc_qdrant_at')) {
                    if (Schema::hasColumn('knowledge_chunks', 'qdrant_upserted_at')) {
                        $table->index(['docs_id', 'qdrant_upserted_at'], 'idx_kc_doc_qdrant_at');
                    }
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('knowledge_docs')) {
            Schema::table('knowledge_docs', function (Blueprint $table) {
                foreach (['idx_kd_sym_proc', 'idx_kd_cat_proc_created', 'idx_kd_hash', 'idx_kd_pub_desc', 'idx_kd_sym_pub'] as $name) {
                    if ($this->indexExists('knowledge_docs', $name)) {
                        $table->dropIndex($name);
                    }
                }
            });
        }

        if (Schema::hasTable('knowledge_chunks')) {
            Schema::table('knowledge_chunks', function (Blueprint $table) {
                if ($this->indexExists('knowledge_chunks', 'idx_kc_doc_qdrant_at')) {
                    $table->dropIndex('idx_kc_doc_qdrant_at');
                }
            });
        }
    }
};
