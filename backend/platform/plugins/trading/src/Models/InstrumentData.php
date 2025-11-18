<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;
use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;
use Ramsey\Uuid\Uuid;

class InstrumentData extends Model{
    protected $table = 'instrument_data';
    protected $keyType = 'string';
    protected $primaryKey = 'id';
    protected $fillable = [
        'timestamps',
        'instrument_period_id',
        'source',
        'open',
        'high',
        'low',
        'close',
        'volume',
        'slug'
    ];
    public $timestamps = true;

    protected static function booted(){
        static::creating(function ($model) {
            $model->id = Uuid::uuid4();
        });
    }

    public function instrumentperiod(){
        return $this->belongsTo(InstrumentPeriods::class);
    }
}