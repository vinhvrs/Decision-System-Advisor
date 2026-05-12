<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Fire-and-forget hooks to python_engine after the HTTP response is sent (Laravel ``afterResponse``).
 */
class PythonEngineTriggerService
{
    /**
     * Ask python_engine to run ``dashboard:daily`` warm-up (Redis + optional socket fan-out).
     * Requires ``PYTHON_ENGINE_URL`` and matching ``ENGINE_INTERNAL_TRIGGER_SECRET`` in Laravel and python_engine .env.
     */
    public static function requestDashboardWarmUpAfterResponse(): void
    {
        $flag = strtolower((string) env('PYTHON_ENGINE_TRIGGER_DASHBOARD_WARMUP', '1'));
        if (in_array($flag, ['0', 'false', 'no', 'off'], true)) {
            return;
        }

        $base = rtrim((string) config('services.python_engine.url', ''), '/');
        if ($base === '') {
            return;
        }

        $secret = (string) config('services.python_engine.trigger_secret', '');
        $insecureLocal = in_array(
            strtolower((string) env('PYTHON_ENGINE_TRIGGER_INSECURE_LOCAL', '0')),
            ['1', 'true', 'yes'],
            true
        );
        if ($secret === '' && ! $insecureLocal) {
            return;
        }

        dispatch(function () use ($base, $secret): void {
            try {
                $req = Http::timeout(5)
                    ->connectTimeout(2)
                    ->asJson();
                if ($secret !== '') {
                    $req = $req->withHeaders(['X-Engine-Trigger-Token' => $secret]);
                }
                $req->post("{$base}/internal/tasks/dashboard-warm-up", []);
            } catch (\Throwable $e) {
                Log::debug('python_engine dashboard warm-up trigger failed', [
                    'error' => $e->getMessage(),
                ]);
            }
        })->afterResponse();
    }
}
