<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('admin_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('client_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('direction', 16)->index();
            $table->string('from_email', 320);
            $table->string('to_email', 320)->index();
            $table->string('subject', 512);
            $table->text('body_text');
            $table->string('status', 32)->default('sent')->index();
            $table->text('error_message')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_messages');
    }
};
