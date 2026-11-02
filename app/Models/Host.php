<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Host extends Model
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
            'cpu_percent' => 'float',
            'memory_used' => 'integer',
            'memory_total' => 'integer',
            'disk_used' => 'integer',
            'disk_total' => 'integer',
            'load_1' => 'float',
            'load_5' => 'float',
            'load_15' => 'float',
            'last_seen_at' => 'datetime',
        ];
    }

    /**
     * A host is considered offline when it missed several report intervals.
     */
    public function isOnline(): bool
    {
        return $this->last_seen_at !== null
            && $this->last_seen_at->gt(now()->subSeconds(config('signal.offline_after')));
    }

    public function memoryPercent(): ?float
    {
        return $this->memory_total ? round($this->memory_used / $this->memory_total * 100, 1) : null;
    }

    public function diskPercent(): ?float
    {
        return $this->disk_total ? round($this->disk_used / $this->disk_total * 100, 1) : null;
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function metrics(): HasMany
    {
        return $this->hasMany(HostMetric::class);
    }
}
