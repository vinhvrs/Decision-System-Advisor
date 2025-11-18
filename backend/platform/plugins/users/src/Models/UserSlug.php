<?php
namespace Plugins\Users\Models;

use Illuminate\Database\Eloquent\Model;

class UserSlug extends Model
{
    protected $table = 'users_slug';

    protected $fillable = [
        'user_id',
        'slug',
        'prefix',
        'suffix',
        'created_at',
        'updated_at',
    ];
}