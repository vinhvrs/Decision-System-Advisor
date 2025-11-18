<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;

class Knowledge extends Model
{
    protected $table = 'knowledge';

    protected $fillable = [
        'topic',
        'content',
        'author',
        'slug',
        'created_at',
        'updated_at',
    ];

    public function chunks()
    {
        return $this->hasMany(KnowledgeChunk::class, 'knowledge_id');
    }
}
