<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ContactSubmission extends Model
{
    use HasUuids;

    protected $fillable = [
        'name',
        'email',
        'subject',
        'message',
        'read_at',
        'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
        ];
    }

    public function markRead(): void
    {
        if ($this->read_at !== null) {
            return;
        }
        $this->update(['read_at' => now()]);
    }
}
