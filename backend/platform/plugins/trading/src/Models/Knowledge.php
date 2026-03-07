<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;

class Knowledge extends Model
{
    protected $table = 'knowledge';
    protected $keyType = 'string';
    public $incrementing = false;
    
    protected $fillable = [
        'topic',
        'content',
        'source_docs_ids',
        'author',
        'url_slug',
        'published_at'
    ];

    protected $casts = [
        'source_docs_ids' => 'array',     
        'published_at'    => 'datetime',
    ];

    public $timestamps = true;
    
}