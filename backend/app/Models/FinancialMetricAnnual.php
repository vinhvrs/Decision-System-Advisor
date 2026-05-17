<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinancialMetricAnnual extends Model
{
    protected $table = 'fundamental_data_annual';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'period_end' => 'date',
            'filing_date' => 'date',
        ];
    }
}
