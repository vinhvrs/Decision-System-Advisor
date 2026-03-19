<?php

namespace Platform\Plugins\Users\Src\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Watchlist extends Model
{
    protected static function booted(): void
    {
        static::creating(function (Watchlist $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    protected $table = 'watchlist';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'symbol',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
