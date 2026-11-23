<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::table('news_articles', function (Blueprint $table) {
            $table->string('hero_image', 2048)->nullable();
            $table->json('media')->nullable();
            $table->unsignedTinyInteger('media_version')->default(0);
            $table->unsignedTinyInteger('media_attempts')->default(0);
            $table->dateTime('media_checked_at')->nullable();
            $table->string('media_error', 1000)->nullable();
        });
    }
    public function down(): void {
        Schema::table('news_articles', fn (Blueprint $table) => $table->dropColumn(['hero_image','media','media_version','media_attempts','media_checked_at','media_error']));
    }
};
