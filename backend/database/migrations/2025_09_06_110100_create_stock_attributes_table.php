<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('stock_attributes', function (Blueprint $table) {
            $table->uuid('id')->primary();

            // Foreign key to instruments table
            $table->uuid('instrument_id');
            $table->foreign('instrument_id')->references('id')->on('instruments')->onDelete('cascade');

            // Date of forecast
            $table->date('date');

            // Forecast fields
            $table->bigInteger('revenue_low');
            $table->bigInteger('revenue_high');
            $table->bigInteger('revenue_avg');

            $table->bigInteger('ebitda_low');
            $table->bigInteger('ebitda_high');
            $table->bigInteger('ebitda_avg');

            $table->bigInteger('ebit_low');
            $table->bigInteger('ebit_high');
            $table->bigInteger('ebit_avg');

            $table->bigInteger('net_income_low');
            $table->bigInteger('net_income_high');
            $table->bigInteger('net_income_avg');

            $table->bigInteger('sga_expense_low');
            $table->bigInteger('sga_expense_high');
            $table->bigInteger('sga_expense_avg');

            $table->decimal('eps_low', 10, 4);
            $table->decimal('eps_high', 10, 4);
            $table->decimal('eps_avg', 10, 4);

            $table->unsignedInteger('num_analysts_revenue');
            $table->unsignedInteger('num_analysts_eps');

            // Optional fields
            $table->decimal('confidence_score', 5, 2)->nullable();
            $table->enum('recommendation', ['Buy', 'Hold', 'Sell'])->nullable();

            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('stock_attributes');
    }
};