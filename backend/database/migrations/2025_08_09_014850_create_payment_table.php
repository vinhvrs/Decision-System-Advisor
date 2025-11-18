<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment', function (Blueprint $table)
        {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('visa_number', 16)->nullable();
            $table->string('cardholder_name', 100)->nullable();
            $table->string('CCV', 3)->nullable();
            $table->date('expiry')->nullable();
            $table->date('valid')->nullable();
            $table->timestamps();
        });
    }

};