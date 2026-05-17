<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FundamentalScore extends Model
{
    protected $table = 'fundamental_scores';

    protected $fillable = [
        'symbol',
        'growth_score',
        'profitability_score',
        'balance_sheet_score',
        'cash_flow_score',
        'capital_efficiency_score',
        'overall_score',
        'meta',
        'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'computed_at' => 'datetime',
        ];
    }
}
