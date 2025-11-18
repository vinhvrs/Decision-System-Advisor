<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;

class KnowledgeDoc extends Model
{
    protected $table = 'knowledge_docs';

    protected $fillable = [
        'title',
        'content',
        'category',
        'source',
        'author',
        'language',
        'created_at',
        'updated_at',
    ];
}
