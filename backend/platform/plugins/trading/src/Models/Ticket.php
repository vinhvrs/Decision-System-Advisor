<?php

namespace Platform\Plugins\Trading\Src\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Ticket extends Model
{
    protected static function booted(): void
    {
        static::creating(function (Ticket $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }
    protected $table = 'tickets';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'type',
        'market',
        'symbol',
        'leverage',
        'volume',
        'price',
        'status',
        'profit',
        'open',
        'close',
    ];

    protected $casts = [
        'leverage' => 'decimal:4',
        'volume' => 'decimal:8',
        'price' => 'decimal:8',
        'profit' => 'decimal:8',
        'open' => 'datetime',
        'close' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * real_value = price * leverage * volume
     */
    public function getRealValueAttribute(): float
    {
        return (float) ($this->price * $this->leverage * $this->volume);
    }

    /**
     * Buy/Long:  P = (Current - Open) × Volume × Leverage
     * Sell/Short: P = (Open - Current) × Volume × Leverage
     * Returns profit for Buy; negate for Sell.
     */
    public static function calcRealProfit(float $newPrice, float $openPrice, float $leverage, float $volume): float
    {
        if ($openPrice <= 0) {
            return 0.0;
        }
        return ($newPrice - $openPrice) * ($volume * $leverage);
    }

    /**
     * Unrealized profit for display (same formula as calcRealProfit).
     */
    public static function calcShowProfit(float $newPrice, float $openPrice, float $leverage, float $volume): float
    {
        return self::calcRealProfit($newPrice, $openPrice, $leverage, $volume);
    }
}
