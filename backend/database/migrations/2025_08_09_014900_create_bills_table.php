<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bills', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->decimal('amount', 10, 2);
            $table->string('status', 50);
            $table->dateTime('due_date');
            $table->string('description')->nullable();
            $table->string('currency', 3)->default('USD');
            $table->timestamps();
        });
    }

};