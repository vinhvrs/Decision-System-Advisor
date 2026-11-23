<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('market_bars_30m',function(Blueprint $t){
            $t->string('source_code',32)->nullable(); $t->dateTime('retrieved_at')->nullable();
            $t->string('volume_type',24)->nullable(); $t->string('adjustment_basis',32)->nullable();
        });
        Schema::create('market_rollup_sources',function(Blueprint $t){
            $t->unsignedBigInteger('asset_id');$t->string('target',32);$t->string('period',12);$t->date('bucket_date');
            $t->json('source_codes_json');$t->json('volume_types_json');$t->json('adjustment_basis_json');
            $t->dateTime('retrieved_at')->nullable();$t->string('quality',32);
            $t->primary(['asset_id','target','period','bucket_date'],'pk_rollup_sources');
        });
        // Old bars retain NULL provenance; never assign a current provider retrospectively.
    }
    public function down(): void
    {
        Schema::dropIfExists('market_rollup_sources');
        Schema::table('market_bars_30m',fn(Blueprint $t)=>$t->dropColumn(['source_code','retrieved_at','volume_type','adjustment_basis']));
    }
};
