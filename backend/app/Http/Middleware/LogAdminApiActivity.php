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
            $route = $request->route();
            $context = $this->buildContext($request, $response, $route);

            AdminActivityLog::query()->create([
                'user_id' => $request->user()->id,
                'level' => 'action',
                'channel' => 'admin_api',
                'message' => $this->buildMessage($request, $context),
                'context' => $context,
                'ip_address' => $request->ip(),
            ]);
        } catch (\Throwable) {
            /* never break admin flow */
        }

        return $response;
    }

    /**
     * @param  \Illuminate\Routing\Route|null  $route
     * @return array<string, mixed>
     */
    private function buildContext(Request $request, Response $response, $route): array
    {
        $context = [
            'status' => $response->getStatusCode(),
            'route' => $route?->getName() ?? $route?->uri() ?? $request->path(),
        ];

        $job = $request->input('job');
        if (is_string($job) && $job !== '') {
            $context['job'] = $job;
        }

        $symbol = $request->input('symbol');
        if (is_string($symbol) && $symbol !== '') {
            $context['symbol'] = strtoupper(trim($symbol));
        }

        $contentType = (string) $response->headers->get('Content-Type', '');
        if (str_contains($contentType, 'json')) {
            $decoded = json_decode($response->getContent(), true);
            if (is_array($decoded)) {
                if (isset($decoded['data']['accepted'])) {
                    $context['accepted'] = (bool) $decoded['data']['accepted'];
                }
                if (isset($decoded['data']['job']) && is_string($decoded['data']['job'])) {
                    $context['job'] = $decoded['data']['job'];
                }
                if (isset($decoded['message']) && is_string($decoded['message'])) {
                    $context['response_message'] = $decoded['message'];
                }
            }
        }

        return $context;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function buildMessage(Request $request, array $context): string
    {
        $base = $request->method().' '.$request->path();

        if (isset($context['job']) && is_string($context['job'])) {
            $base .= ' · '.$context['job'];
            if (($context['accepted'] ?? null) === true) {
                $base .= ' queued';
            }
        }

        return $base;
    }
}
