<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;

class KnowledgeDoc extends Model
{
    protected $table = 'knowledge_docs';
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

    public function chunks()
    {
        return $this->hasMany(KnowledgeChunk::class, 'docs_id');
    }

    public function companyProfile()
    {
        return $this->belongsTo(CompanyProfile::class, 'symbol', 'symbol');
    }
}