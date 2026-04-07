<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;

class KnowledgeChunk extends Model
{
    protected $table = 'knowledge_chunks';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'docs_id',
        'chunk_index',
        'content',
        'token',
        'data',
        'qdrant_point_id',    
        'qdrant_upserted_at',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'data' => 'array',
        'qdrant_upserted_at' => 'datetime',
    ];

    /** Parent row in knowledge_docs */
    public function document()
    {
        return $this->belongsTo(KnowledgeDoc::class, 'docs_id');
    }
}