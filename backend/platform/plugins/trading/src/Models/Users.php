<?php

namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Ramsey\Uuid\Uuid;

class Users extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $table = 'users';
    protected $keyType = 'string';

    protected $fillable = [
        'username',
        'password',
        'name',
        'email',
        'phone',
        'email_verified_at',
    ];

    public $timestamps = true;

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = Uuid::uuid4()->toString();
            }
        });
    }
}
