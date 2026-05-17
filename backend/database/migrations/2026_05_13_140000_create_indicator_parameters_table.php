<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('indicator_parameters', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('indicator_id');
            $table->string('param_key', 120);
            $table->text('param_value')->nullable();
            $table->string('value_type', 32)->default('string'); // string|number|boolean|json
            $table->string('label', 200)->nullable();
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('indicator_id')
                ->references('id')
                ->on('indicators')
                ->cascadeOnDelete();

            $table->unique(['indicator_id', 'param_key'], 'uq_indicator_parameters_indicator_key');
            $table->index(['indicator_id', 'sort_order'], 'idx_indicator_parameters_indicator_sort');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('indicator_parameters');
    }
};
