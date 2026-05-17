<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_mail_settings', function (Blueprint $table) {
            $table->id();
            /** Inbound copy for new public contact submissions (overrides MAIL_SUPPORT_ADDRESS when set). */
            $table->string('contact_notification_email', 320)->nullable();
            /** Shown on the public contact page and in footers when configured. */
            $table->string('support_public_email', 320)->nullable();
            $table->text('internal_notes')->nullable();
            $table->timestamps();
        });

        DB::table('site_mail_settings')->insert([
            'contact_notification_email' => null,
            'support_public_email' => null,
            'internal_notes' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('site_mail_settings');
    }
};
