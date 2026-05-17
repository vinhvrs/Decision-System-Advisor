<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('company_facts_raw')) {
            Schema::create('company_facts_raw', function (Blueprint $table) {
            $table->id();
            $table->string('symbol', 16)->index();
            $table->string('cik', 20);
            $table->string('payload_type', 32);
            $table->longText('raw_json');
            $table->timestamp('fetched_at')->nullable();
            $table->timestamps();
            $table->unique(['symbol', 'payload_type']);
        });
        }

        if (! Schema::hasTable('company_filings')) {
            Schema::create('company_filings', function (Blueprint $table) {
            $table->id();
            $table->string('symbol', 16)->index();
            $table->string('form', 32)->index();
            $table->string('accession_number', 32)->unique();
            $table->date('filing_date')->nullable()->index();
            $table->date('report_date')->nullable();
            $table->string('primary_document', 512)->nullable();
            $table->text('filing_url')->nullable();
            $table->timestamps();
        });
        }

        if (! Schema::hasTable('fundamental_data_annual')) {
            Schema::create('fundamental_data_annual', function (Blueprint $table) {
            $table->id();
            $table->string('symbol', 16)->index();
            $table->unsignedSmallInteger('fiscal_year')->index();
            $table->date('period_end')->nullable();
            $table->date('filing_date')->nullable();
            $table->string('source', 32)->default('SEC');

            $table->decimal('revenue', 28, 4)->nullable();
            $table->decimal('net_income', 28, 4)->nullable();
            $table->decimal('gross_profit', 28, 4)->nullable();
            $table->decimal('operating_income', 28, 4)->nullable();
            $table->decimal('eps_diluted', 28, 8)->nullable();
            $table->decimal('assets', 28, 4)->nullable();
            $table->decimal('liabilities', 28, 4)->nullable();
            $table->decimal('equity', 28, 4)->nullable();
            $table->decimal('cash', 28, 4)->nullable();
            $table->decimal('total_debt', 28, 4)->nullable();
            $table->decimal('current_assets', 28, 4)->nullable();
            $table->decimal('current_liabilities', 28, 4)->nullable();
            $table->decimal('inventory', 28, 4)->nullable();
            $table->decimal('accounts_receivable', 28, 4)->nullable();
            $table->decimal('cost_of_revenue', 28, 4)->nullable();
            $table->decimal('operating_cash_flow', 28, 4)->nullable();
            $table->decimal('capex', 28, 4)->nullable();
            $table->decimal('fcf', 28, 4)->nullable();
            $table->decimal('interest_expense', 28, 4)->nullable();
            $table->decimal('dividends_paid', 28, 4)->nullable();
            $table->decimal('shares_outstanding', 28, 4)->nullable();
            $table->decimal('public_float', 28, 4)->nullable();

            $table->decimal('gross_margin', 18, 8)->nullable();
            $table->decimal('operating_margin', 18, 8)->nullable();
            $table->decimal('net_margin', 18, 8)->nullable();
            $table->decimal('roe', 18, 8)->nullable();
            $table->decimal('debt_equity', 18, 8)->nullable();
            $table->decimal('current_ratio', 18, 8)->nullable();
            $table->decimal('asset_turnover', 18, 8)->nullable();
            $table->decimal('dso', 18, 4)->nullable();
            $table->decimal('dio', 18, 4)->nullable();
            $table->decimal('interest_coverage', 18, 8)->nullable();

            $table->decimal('revenue_cagr_3y', 18, 8)->nullable();
            $table->decimal('revenue_cagr_5y', 18, 8)->nullable();
            $table->decimal('revenue_cagr_10y', 18, 8)->nullable();
            $table->decimal('net_income_cagr_3y', 18, 8)->nullable();
            $table->decimal('net_income_cagr_5y', 18, 8)->nullable();
            $table->decimal('net_income_cagr_10y', 18, 8)->nullable();
            $table->decimal('fcf_cagr_3y', 18, 8)->nullable();
            $table->decimal('fcf_cagr_5y', 18, 8)->nullable();
            $table->decimal('fcf_cagr_10y', 18, 8)->nullable();

            $table->timestamps();
            $table->unique(['symbol', 'fiscal_year'], 'uq_fd_annual_sym_fy');
        });
        }

        if (! Schema::hasTable('fundamental_data_quarterly')) {
            Schema::create('fundamental_data_quarterly', function (Blueprint $table) {
            $table->id();
            $table->string('symbol', 16)->index();
            $table->unsignedSmallInteger('fiscal_year');
            $table->unsignedTinyInteger('fiscal_quarter');
            $table->date('period_end')->nullable();
            $table->date('filing_date')->nullable();
            $table->string('source', 32)->default('SEC');

            $table->decimal('revenue', 28, 4)->nullable();
            $table->decimal('net_income', 28, 4)->nullable();
            $table->decimal('gross_profit', 28, 4)->nullable();
            $table->decimal('operating_income', 28, 4)->nullable();
            $table->decimal('eps_diluted', 28, 8)->nullable();
            $table->decimal('assets', 28, 4)->nullable();
            $table->decimal('liabilities', 28, 4)->nullable();
            $table->decimal('equity', 28, 4)->nullable();
            $table->decimal('cash', 28, 4)->nullable();
            $table->decimal('total_debt', 28, 4)->nullable();
            $table->decimal('current_assets', 28, 4)->nullable();
            $table->decimal('current_liabilities', 28, 4)->nullable();
            $table->decimal('inventory', 28, 4)->nullable();
            $table->decimal('accounts_receivable', 28, 4)->nullable();
            $table->decimal('cost_of_revenue', 28, 4)->nullable();
            $table->decimal('operating_cash_flow', 28, 4)->nullable();
            $table->decimal('capex', 28, 4)->nullable();
            $table->decimal('fcf', 28, 4)->nullable();
            $table->decimal('interest_expense', 28, 4)->nullable();
            $table->decimal('dividends_paid', 28, 4)->nullable();
            $table->decimal('shares_outstanding', 28, 4)->nullable();

            $table->decimal('gross_margin', 18, 8)->nullable();
            $table->decimal('operating_margin', 18, 8)->nullable();
            $table->decimal('net_margin', 18, 8)->nullable();
            $table->decimal('roe', 18, 8)->nullable();
            $table->decimal('debt_equity', 18, 8)->nullable();
            $table->decimal('current_ratio', 18, 8)->nullable();

            $table->timestamps();
            $table->unique(['symbol', 'fiscal_year', 'fiscal_quarter'], 'uq_fd_quarter_sym_fy_q');
        });
        }

        if (! Schema::hasTable('fundamental_scores')) {
            Schema::create('fundamental_scores', function (Blueprint $table) {
            $table->id();
            $table->string('symbol', 16)->unique();
            $table->decimal('growth_score', 6, 2)->nullable();
            $table->decimal('profitability_score', 6, 2)->nullable();
            $table->decimal('balance_sheet_score', 6, 2)->nullable();
            $table->decimal('cash_flow_score', 6, 2)->nullable();
            $table->decimal('capital_efficiency_score', 6, 2)->nullable();
            $table->decimal('overall_score', 6, 2)->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('computed_at')->nullable();
            $table->timestamps();
        });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('fundamental_scores');
        Schema::dropIfExists('fundamental_data_quarterly');
        Schema::dropIfExists('fundamental_data_annual');
        Schema::dropIfExists('company_filings');
        Schema::dropIfExists('company_facts_raw');
    }
};
