<?php

namespace App\Http\Middleware;

use App\Models\AdminActivityLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LogAdminApiActivity
{
    /**
     * Record mutating admin API calls (POST/PUT/PATCH/DELETE) for audit trail.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $request->user()) {
            return $response;
        }

        if (! in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return $response;
        }

        try {
            AdminActivityLog::query()->create([
                'user_id' => $request->user()->id,
                'level' => 'action',
                'channel' => 'admin_api',
                'message' => $request->method().' '.$request->path(),
                'context' => [
                    'status' => $response->getStatusCode(),
                    'route' => $request->route()?->getName(),
                ],
                'ip_address' => $request->ip(),
            ]);
        } catch (\Throwable) {
            /* never break admin flow */
        }

        return $response;
    }
}
