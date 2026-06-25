<?php
namespace Platform\Plugins\Trading\Src\Models;

use App\Support\UsesDsaTable;
use Illuminate\Database\Eloquent\Model;
use Ramsey\Uuid\Uuid;
use Platform\Plugins\Trading\Src\Models\StockAttribute; 
use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;

class Instruments extends Model{
    use UsesDsaTable;

    protected static function dsaLogicalTable(): string
    {
        return 'instruments';
    }
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