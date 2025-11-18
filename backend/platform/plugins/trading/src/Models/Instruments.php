<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;
use Ramsey\Uuid\Uuid;
use Platform\Plugins\Trading\Src\Models\StockAttribute; 
use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;

class Instruments extends Model{
    protected $table = 'instruments';
    protected $keyType = 'string';
    protected $fillable = [
        'name',
        'symbol',
        'type',
        'exchange',
        'slug'
    ];
    // public $incrementing = false;
    public $timestamps = true;

    protected static function booted(){
        static::creating(function ($model) {
            $model->id = Uuid::uuid4()->toString();
        });
    }

    public function instrument_periods(){
        return $this->hasMany(InstrumentPeriods::class);
    }

    public function stock_attributes(){
        return $this->hasMany(StockAttribute::class);
    }

}