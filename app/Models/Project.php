<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Project extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'slug',
        'environment',
        'last_seen_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'token_hash',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_seen_at' => 'datetime',
            'certificate_expires_at' => 'datetime',
        ];
    }

    /**
     * Get the route key for the model.
     */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * Issue a new ingest token. The plain token is returned once and only its hash is stored.
     */
    public function issueToken(): string
    {
        $token = 'sig_'.Str::random(40);

        $this->forceFill(['token_hash' => self::hashToken($token)])->save();

        return $token;
    }

    /**
     * Find the project that owns the given plain ingest token.
     */
    public static function findByToken(string $token): ?self
    {
        return self::where('token_hash', self::hashToken($token))->first();
    }

    /**
     * Hash a plain ingest token.
     */
    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * Generate a unique slug for the given name.
     */
    public static function uniqueSlug(string $name, ?string $environment = null): string
    {
        $base = Str::slug(trim($name.' '.($environment === 'production' ? '' : $environment))) ?: 'project';
        $slug = $base;

        for ($i = 2; self::where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }

    /**
     * The TLS certificate served at the app's URL, or null when none was reported.
     *
     * @return array{host: string|null, issuer: string|null, expires_at: string, days_left: int}|null
     */
    public function certificate(): ?array
    {
        if (! $this->certificate_expires_at) {
            return null;
        }

        return [
            'host' => $this->certificate_host,
            'issuer' => $this->certificate_issuer,
            'expires_at' => $this->certificate_expires_at->toIso8601String(),
            'days_left' => (int) floor(now()->diffInDays($this->certificate_expires_at, false)),
        ];
    }

    public function hosts(): HasMany
    {
        return $this->hasMany(Host::class);
    }

    public function exceptionGroups(): HasMany
    {
        return $this->hasMany(ExceptionGroup::class);
    }

    public function exceptionOccurrences(): HasMany
    {
        return $this->hasMany(ExceptionOccurrence::class);
    }

    public function logEntries(): HasMany
    {
        return $this->hasMany(LogEntry::class);
    }

    public function requestRecords(): HasMany
    {
        return $this->hasMany(RequestRecord::class);
    }

    public function jobRecords(): HasMany
    {
        return $this->hasMany(JobRecord::class);
    }
}
