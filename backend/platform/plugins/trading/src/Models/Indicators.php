<?php

namespace Platform\Plugins\Trading\Src\Models;

use Illuminate\Database\Eloquent\Model;
use Ramsey\Uuid\Uuid;

class Indicators extends Model{
    protected $table = 'indicators';
    protected $keyType = 'string';
    protected $fillable = [
        'name',
        'description',
        'slug'
    ];
    public $timestamps = true;

    protected static function booted(){
        static::creating(function ($model) {
            $model->id = Uuid::uuid4()->toString();
        });
    }

}
