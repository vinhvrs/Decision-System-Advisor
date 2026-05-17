<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Issuer-level fields from SEC submissions (one row per symbol) + optional public float on annual metrics.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fundamental_issuer_profile', function (Blueprint $table) {
            $table->id();
            $table->string('symbol', 16)->unique();
            $table->string('cik', 20)->nullable()->index();
            $table->string('company_name', 512)->nullable();
            $table->json('tickers')->nullable();
            $table->json('exchanges')->nullable();
            $table->string('exchange', 64)->nullable();
            $table->string('sic', 16)->nullable()->index();
            $table->text('sic_description')->nullable();
            $table->string('fiscal_year_end', 8)->nullable();
            $table->timestamps();
        });

        if (Schema::hasTable('fundamental_data_annual')) {
            Schema::table('fundamental_data_annual', function (Blueprint $table) {
                if (! Schema::hasColumn('fundamental_data_annual', 'public_float')) {
                    $table->decimal('public_float', 28, 4)->nullable()->after('shares_outstanding');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('fundamental_data_annual') && Schema::hasColumn('fundamental_data_annual', 'public_float')) {
            Schema::table('fundamental_data_annual', function (Blueprint $table) {
                $table->dropColumn('public_float');
            });
        }

        Schema::dropIfExists('fundamental_issuer_profile');
    }
};
