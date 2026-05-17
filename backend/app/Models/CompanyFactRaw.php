<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanyFactRaw extends Model
{
    protected $table = 'company_facts_raw';

    protected $fillable = [
        'symbol',
        'cik',
        'payload_type',
        'raw_json',
        'fetched_at',
    ];

    protected function casts(): array
    {
        return [
            'fetched_at' => 'datetime',
        ];
    }
}
