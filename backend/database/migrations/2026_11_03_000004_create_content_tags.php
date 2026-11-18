<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up():void {
  Schema::create('content_tags',function(Blueprint $t){$t->string('slug',32)->primary();$t->string('label',80);$t->boolean('is_news');$t->boolean('is_event');});
  Schema::create('content_labels',function(Blueprint $t){$t->string('kind',8);$t->string('document_id',64);$t->string('tag',32);$t->primary(['kind','document_id','tag']);$t->index(['kind','tag','document_id']);});
  Schema::create('content_tagged',function(Blueprint $t){$t->string('kind',8);$t->string('document_id',64);$t->unsignedSmallInteger('version');$t->primary(['kind','document_id']);});
 }
 public function down():void {Schema::dropIfExists('content_tagged');Schema::dropIfExists('content_labels');Schema::dropIfExists('content_tags');}
};
