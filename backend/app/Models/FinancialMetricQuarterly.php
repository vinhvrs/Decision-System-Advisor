<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinancialMetricQuarterly extends Model
{
    protected $table = 'fundamental_data_quarterly';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'period_end' => 'date',
            'filing_date' => 'date',
        ];
    }
}
