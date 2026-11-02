<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobRecord extends Model
{
    public const STATUSES = ['processed', 'released', 'failed'];

    public $timestamps = false;

    /**
     * The attributes that aren't mass assignable.
     *
     * @var list<string>
     */
    protected $guarded = ['id'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'recorded_at' => 'datetime',
        ];
    }
}
