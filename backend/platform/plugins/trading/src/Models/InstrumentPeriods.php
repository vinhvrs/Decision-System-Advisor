<?php 
namespace Platform\Plugins\Trading\Src\Models;

use App\Support\UsesDsaTable;
use Illuminate\Database\Eloquent\Model;
use Platform\Plugins\Trading\Src\Models\InstrumentData;
use Ramsey\Uuid\Uuid;

class InstrumentPeriods extends Model{
    use UsesDsaTable;

    protected static function dsaLogicalTable(): string
    {
        return 'instrument_periods';
    }
    protected $keyType = 'string';
    protected $fillable = [
        'instrument_id',
        'period',
        'market',
        'slug',
        'prefix'
    ];
    // public $incrementing = false;
    public $timestamps = true;

    protected static function booted(){
        static::creating(function ($model) {
            $model->id = Uuid::uuid4()->toString();
        });
    }

    public function instrument(){
        return $this->belongsTo(Instruments::class);
    }

    public function instrumentdata(){
        return $this->hasMany(InstrumentData::class);
    }
}