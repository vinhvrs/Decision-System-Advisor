<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanyFiling extends Model
{
    protected $table = 'company_filings';

    protected $fillable = [
        'symbol',
        'form',
        'accession_number',
        'filing_date',
        'report_date',
        'primary_document',
        'filing_url',
    ];

    protected function casts(): array
    {
        return [
            'filing_date' => 'date',
            'report_date' => 'date',
        ];
    }
}
