<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {

    public function up(): void
    {
        Schema::table('knowledge_chunks', function (Blueprint $table) {

            // Lưu point id trên Qdrant (UUID)
            $table->uuid('qdrant_point_id')
                ->nullable()
                ->after('vector')
                ->index();

            // Lưu thời điểm đã upsert sang Qdrant
            $table->timestamp('qdrant_upserted_at')
                ->nullable()
                ->after('qdrant_point_id')
                ->index();
        });
    }

    public function down(): void
    {
        Schema::table('knowledge_chunks', function (Blueprint $table) {

            $table->dropIndex(['qdrant_point_id']);
            $table->dropIndex(['qdrant_upserted_at']);

            $table->dropColumn([
                'qdrant_point_id',
                'qdrant_upserted_at'
            ]);
        });
    }
};