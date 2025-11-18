<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('instruments', function (Blueprint $table) {
            $table->string('name', 500)->change();
            $table->string('slug', 300)->change();
        });
    }

    public function down()
    {
        Schema::table('instruments', function (Blueprint $table) {
            $table->string('name', 255)->change();
            $table->string('slug', 255)->change();
        });
    }
};
