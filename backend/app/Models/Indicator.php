<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Catalog row for the core ``indicators`` table (UUID primary key).
 */
class Indicator extends Model
{
    use HasUuids;

    protected $table = 'indicators';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'name',
        'description',
        'slug',
    ];

    public function parameters(): HasMany
    {
        return $this->hasMany(IndicatorParameter::class, 'indicator_id', 'id');
    }
}
