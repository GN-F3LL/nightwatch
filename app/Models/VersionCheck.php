<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VersionCheck extends Model
{
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
            'advisories' => 'array',
            'eol' => 'boolean',
            'eol_date' => 'date',
            'checked_at' => 'datetime',
        ];
    }
}
