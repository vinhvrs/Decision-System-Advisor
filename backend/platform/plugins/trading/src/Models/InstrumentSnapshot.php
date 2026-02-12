<?php
namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;
use Ramsey\Uuid\Uuid;

class InstrumentSnapshot extends Model
{
    protected $table = 'instrument_snapshot';
    protected $primaryKey = 'instrument_id';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'instrument_id',
        'symbol',
        'price',
        'open',
        'volume',
        'liquidity',
        'change_pct',
        'updated_at'
    ];
}
