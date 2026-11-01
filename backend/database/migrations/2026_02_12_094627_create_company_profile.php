<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('company_profile', function (Blueprint $table) {
            $table->uuid('instrument_id');
            $table->foreign('instrument_id')
                ->references('id')
                ->on('instruments')
                ->onDelete('cascade');
            $table->string('exchange');
            $table->string('company_name');
            $table->string('symbol')->index();
            $table->double('market_cap')->nullable();
            $table->string('industry')->nullable()->index();
            $table->string('sector')->nullable()->index();
            $table->string('website')->nullable();
            $table->text('description')->nullable();
            $table->string('ceo')->nullable();
            $table->string('country')->nullable();
            $table->string('image')->nullable();
            $table->integer('full_time_employees')->nullable();
            $table->date('ipo_date')->nullable();
            $table->timestamps();

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('company_profile');
    }
};
