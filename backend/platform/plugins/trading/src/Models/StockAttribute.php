<?php
namespace Platform\Plugins\Trading\Src\Models;
use Illuminate\Database\Eloquent\Model;
use Ramsey\Uuid\Uuid;
use Platform\Plugins\Trading\Src\Models\Instruments;

class StockAttribute extends Model
{
    protected $table = 'stock_attributes';
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'date',
        'instrument_id',
        'revenue_low', 'revenue_high', 'revenue_avg',
        'ebitda_low', 'ebitda_high', 'ebitda_avg',
        'ebit_low', 'ebit_high', 'ebit_avg',
        'net_income_low', 'net_income_high', 'net_income_avg',
        'sga_expense_low', 'sga_expense_high', 'sga_expense_avg',
        'eps_low', 'eps_high', 'eps_avg',
        'num_analysts_revenue', 'num_analysts_eps',
        'confidence_score', 'recommendation'
    ];

    public $timestamps = true;

    protected static function booted()
    {
        static::creating(function ($model) {
            $model->id = Uuid::uuid4()->toString();
        });
    }

    public function instrument()
    {
        return $this->belongsTo(Instruments::class);
    }
}