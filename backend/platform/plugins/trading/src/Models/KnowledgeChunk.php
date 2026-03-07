<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;

class KnowledgeChunk extends Model
{
    protected $table = 'knowledge_chunks';
    protected $keyType = 'string';
    public $incrementing = false; // Quan trọng khi dùng UUID

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

    // Thay đổi relation trỏ về bảng chứa dữ liệu thô
    public function document()
    {
        return $this->belongsTo(KnowledgeDoc::class, 'docs_id');
    }
}