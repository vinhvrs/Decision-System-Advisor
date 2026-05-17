<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FundamentalIssuerProfile extends Model
{
    protected $table = 'fundamental_issuer_profile';

    protected $fillable = [
        'symbol',
        'cik',
        'company_name',
        'tickers',
        'exchanges',
        'exchange',
        'sic',
        'sic_description',
        'fiscal_year_end',
    ];

    protected function casts(): array
    {
        return [
            'tickers' => 'array',
            'exchanges' => 'array',
        ];
    }
}
