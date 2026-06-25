<?php
namespace Platform\Plugins\Trading\Src\Models;

use App\Support\UsesDsaTable;
use Illuminate\Database\Eloquent\Model;
use Ramsey\Uuid\Uuid;

class InstrumentSnapshot extends Model
{
    use UsesDsaTable;

    protected static function dsaLogicalTable(): string
    {
        return 'instrument_snapshot';
    }
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
