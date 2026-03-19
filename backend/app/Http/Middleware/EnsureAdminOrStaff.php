<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminOrStaff
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $role = $user->role ?? null;
        if (!in_array($role, ['admin', 'staff'], true)) {
            return response()->json(['message' => 'Forbidden. Admin or staff role required.'], 403);
        }

        return $next($request);
    }
}
