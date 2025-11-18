<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
public function up()
{
    Schema::table('instrument_data', function (Blueprint $table) {
        $table->unsignedBigInteger('volume')->nullable()->change();
    });
}

public function down()
{
    Schema::table('instrument_data', function (Blueprint $table) {
        $table->integer('volume')->nullable()->change();
    });
}

};
