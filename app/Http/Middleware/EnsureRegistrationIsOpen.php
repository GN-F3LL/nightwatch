<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRegistrationIsOpen
{
    /**
     * Self-hosted: only the first account may sign up. Later users are added by an existing one.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! self::isOpen()) {
            return redirect()->route('login');
        }

        return $next($request);
    }

    public static function isOpen(): bool
    {
        return config('signal.open_registration') || ! User::query()->exists();
    }
}
