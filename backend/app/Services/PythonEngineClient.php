<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Call python_engine internal task endpoints (dashboard warm-up, data backfill, …).
 */
class PythonEngineClient
{
    public static function baseUrl(): string
    {
        return rtrim((string) config('services.python_engine.url', ''), '/');
    }

    public static function isConfigured(): bool
    {
        if (self::baseUrl() === '') {
            return false;
        }

        $secret = (string) config('services.python_engine.trigger_secret', '');
        $insecureLocal = in_array(
            strtolower((string) env('PYTHON_ENGINE_TRIGGER_INSECURE_LOCAL', '0')),
            ['1', 'true', 'yes'],
            true
        );

        return $secret !== '' || $insecureLocal;
    }

    /**
     * @return array<string, mixed>
     */
    public static function postInternal(string $path, array $body, int $timeoutSeconds = 15): array
    {
        $base = self::baseUrl();
        if ($base === '') {
            return ['ok' => false, 'error' => 'PYTHON_ENGINE_URL is not set'];
        }

        if (! self::isConfigured()) {
            return [
                'ok' => false,
                'error' => 'Set ENGINE_INTERNAL_TRIGGER_SECRET or PYTHON_ENGINE_TRIGGER_INSECURE_LOCAL=1',
            ];
        }

        try {
            $req = Http::timeout($timeoutSeconds)
                ->connectTimeout(3)
                ->asJson();

            $secret = (string) config('services.python_engine.trigger_secret', '');
            if ($secret !== '') {
                $req = $req->withHeaders(['X-Engine-Trigger-Token' => $secret]);
            }

            $response = $req->post("{$base}{$path}", $body);

            if (! $response->successful()) {
                return [
                    'ok' => false,
                    'error' => $response->json('detail') ?? $response->body(),
                    'status' => $response->status(),
                ];
            }

            return $response->json() ?? ['ok' => true];
        } catch (\Throwable $e) {
            Log::warning('python_engine request failed', [
                'path' => $path,
                'error' => $e->getMessage(),
            ]);

            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * @return array<string, mixed>
     */
    public static function get(string $path, int $timeoutSeconds = 10): array
    {
        $base = self::baseUrl();
        if ($base === '') {
            return ['ok' => false, 'error' => 'PYTHON_ENGINE_URL is not set'];
        }

        try {
            $response = Http::timeout($timeoutSeconds)
                ->connectTimeout(3)
                ->get("{$base}{$path}");

            if (! $response->successful()) {
                return [
                    'ok' => false,
                    'error' => $response->json('detail') ?? $response->body(),
                    'status' => $response->status(),
                ];
            }

            return $response->json() ?? ['ok' => true];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }
}
