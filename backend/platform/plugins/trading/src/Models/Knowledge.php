<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;

class Knowledge extends Model
{
    protected $table = 'knowledge';
    protected $keyType = 'string';
    protected $fillable = [
        'topic',
        'content',
        'author',
        'url_slug',
        'published_at'
    ];

    public $timestamps = true;

    public function chunks()
    {
        return $this->hasMany(KnowledgeChunk::class, 'knowledge_id');
    }
}
