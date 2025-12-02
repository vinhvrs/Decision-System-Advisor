<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;

class KnowledgeDoc extends Model
{
    protected $table = 'knowledge_docs';
    protected $keyType = 'string';

    protected $fillable = [
        'title',
        'content',
        'category',
        'source',
        'author',
        'language',
    ];

    public $timestamps = true;

}
