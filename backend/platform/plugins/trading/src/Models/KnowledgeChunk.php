<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;

class KnowledgeChunk extends Model
{
    protected $table = 'knowledge_chunks';

    protected $fillable = [
        'knowledge_id',
        'docs_id',
        'chunk_index',
        'content',
        'source',
        'token',
        'vector',
        'data',
        'created_at',
        'updated_at',
    ];

    public function knowledge()
    {
        return $this->belongsTo(Knowledge::class, 'knowledge_id');
    }
}
