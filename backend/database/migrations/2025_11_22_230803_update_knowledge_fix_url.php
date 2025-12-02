<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('knowledge', function (Blueprint $table) {
            $table->longText('url_slug')->change();
        });
    }

    public function down(): void
    {
        Schema::table('knowledge', function (Blueprint $table) {
            $table->longText('url_slug')->change();
        });
    }
};
