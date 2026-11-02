<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExceptionOccurrence extends Model
{
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
            'handled' => 'boolean',
            'trace' => 'array',
            'code' => 'array',
            'context' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(ExceptionGroup::class, 'exception_group_id');
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(Host::class);
    }
}
