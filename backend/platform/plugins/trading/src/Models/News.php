<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;

class News extends Model
{
    protected $table = 'knowledge_docs_temp';
    protected $keyType = 'string';
    public $incrementing = false; 

    protected $fillable = [
        'title',
        'content',
        'image',
        'category',
        'symbol',       
        'source',
        'author',
        'language',
        'is_processed', 
    ];
    public $timestamps = true;
}