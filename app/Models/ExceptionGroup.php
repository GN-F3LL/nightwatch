<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ExceptionGroup extends Model
{
    public const STATUSES = ['unresolved', 'resolved', 'ignored'];

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
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'resolved_at' => 'datetime',
            'regressed_at' => 'datetime',
        ];
    }

    /**
     * Group key: the same class thrown from the same place is the same problem.
     */
    public static function fingerprint(string $class, ?string $file, ?int $line): string
    {
        return sha1($class.'|'.$file.'|'.$line);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function occurrences(): HasMany
    {
        return $this->hasMany(ExceptionOccurrence::class);
    }

    public function latestOccurrence(): HasOne
    {
        return $this->hasOne(ExceptionOccurrence::class)->latestOfMany('occurred_at');
    }
}
