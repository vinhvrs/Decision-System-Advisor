<?php

namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class CrawlerState extends Model
{
    protected $table = 'crawler_states';

    // UUID primary key
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'source',
        'symbol',
        'last_published_at',
        'last_guid',
        'fail_count',
        'last_error',
        'last_run_at',
    ];

    protected $casts = [
        'last_published_at' => 'datetime',
        'last_run_at'       => 'datetime',
    ];

    /*
    |--------------------------------------------------------------------------
    | Auto-generate UUID when creating
    |--------------------------------------------------------------------------
    */
    protected static function booted()
    {
        static::creating(function ($model) {
            if (!$model->id) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Scope: filter by source
    |--------------------------------------------------------------------------
    */
    public function scopeSource($query, string $source)
    {
        return $query->where('source', $source);
    }

    /*
    |--------------------------------------------------------------------------
    | Scope: filter by symbol
    |--------------------------------------------------------------------------
    */
    public function scopeSymbol($query, string $symbol)
    {
        return $query->where('symbol', strtoupper($symbol));
    }

    /*
    |--------------------------------------------------------------------------
    | Helper: mark success
    |--------------------------------------------------------------------------
    */
    public function markSuccess(?\Carbon\Carbon $publishedAt = null, ?string $guid = null): void
    {
        $this->last_published_at = $publishedAt;
        $this->last_guid = $guid;
        $this->fail_count = 0;
        $this->last_error = null;
        $this->last_run_at = now();
        $this->save();
    }

    /*
    |--------------------------------------------------------------------------
    | Helper: mark failure
    |--------------------------------------------------------------------------
    */
    public function markFailure(string $error): void
    {
        $this->fail_count += 1;
        $this->last_error = $error;
        $this->last_run_at = now();
        $this->save();
    }
}