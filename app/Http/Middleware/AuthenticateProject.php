<?php

namespace App\Http\Middleware;

use App\Models\Project;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateProject
{
    /**
     * Resolve the project from the agent's bearer token.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        $project = $token ? Project::findByToken($token) : null;

        if (! $project) {
            return response()->json(['message' => 'Invalid project token.'], 401);
        }

        $request->attributes->set('project', $project);

        return $next($request);
    }
}
