<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;

class News extends Model
{
    protected $table = 'knowledge_docs';
    protected $keyType = 'string';
    public $incrementing = false; 

    protected $fillable = [
        'hash_key',
        'title',
        'content',
        'published_at',
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