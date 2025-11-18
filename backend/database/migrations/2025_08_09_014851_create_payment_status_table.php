<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_status', function (Blueprint $table) {
            $table->uuid('id')->primary(); // id transaction
            $table->uuid('payment_id');
            $table->double('amount')->default(0.00);
            $table->string('currency', 3)->default('USD');
            $table->string('status_code', 10);
            $table->string('status_message', 255)->nullable();
            $table->timestamp('status_updated_at')->nullable();
            $table->enum('status', ['pending', 'completed', 'failed'])->default('pending');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_status');
    }
};
