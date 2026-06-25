<?php
namespace Platform\Plugins\Trading\Src\Models;

use App\Support\UsesDsaTable;
use Illuminate\Database\Eloquent\Model;

class CompanyProfile extends Model
{
    use UsesDsaTable;

    protected static function dsaLogicalTable(): string
    {
        return 'company_profile';
    }
    protected $primaryKey = 'instrument_id';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'instrument_id',
        'exchange',
        'company_name',
        'symbol',
        'industry',
        'sector',
        'website',
        'description',
        'ceo',
        'country',
        'image',
        'full_time_employees',
        'ipo_date',
    ];

    protected $casts = [
        'market_cap'          => 'double',
        'full_time_employees' => 'integer',
        'ipo_date'            => 'date',
    ];

    public $timestamps = true;

    public function knowledgeDocs()
    {
        return $this->hasMany(KnowledgeDoc::class, 'symbol', 'symbol');
    }
}