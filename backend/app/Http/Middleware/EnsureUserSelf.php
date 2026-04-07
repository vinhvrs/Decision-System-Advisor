<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserSelf
{
    /**
     * Ensure the authenticated user can only access their own resource (user_id must match).
     */
    public function handle(Request $request, Closure $next, string $param = 'user_id'): Response
    {
        $userId = $request->route($param);
        if (!$userId) {
            return response()->json(['message' => 'Bad request'], 400);
        }

        if ($request->user()?->id !== $userId) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}
