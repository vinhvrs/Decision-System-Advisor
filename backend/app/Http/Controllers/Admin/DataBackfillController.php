<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\PythonEngineClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DataBackfillController extends Controller
{
    private const JOBS = [
        'market_symbol',
        'demo_board_refill',
        'demo_sync_all',
        'news_backfill',
        'market_symbol_demo',
    ];

    public function catalog(): JsonResponse
    {
        $remote = PythonEngineClient::get('/api/v1/admin/data-backfill/catalog');

        if (($remote['ok'] ?? false) === true && isset($remote['jobs'])) {
            return response()->json([
                'data' => [
                    'engine_online' => true,
                    'jobs' => $remote['jobs'],
                ],
            ]);
        }

        return response()->json([
            'data' => [
                'engine_online' => false,
                'engine_error' => $remote['error'] ?? 'python_engine unreachable',
                'jobs' => $this->fallbackCatalog(),
            ],
        ]);
    }

    public function run(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'job' => 'required|string|in:'.implode(',', self::JOBS),
            'symbol' => 'nullable|string|max:16',
            'backfill_days' => 'nullable|integer|min:1|max:3650',
            'limit_year' => 'nullable|integer|min:1990|max:2030',
            'history_period' => 'nullable|string|max:16',
        ]);

        if ($validated['job'] === 'market_symbol' && empty(trim((string) ($validated['symbol'] ?? '')))) {
            return response()->json(['message' => 'symbol is required for market_symbol'], 422);
        }

        if ($validated['job'] === 'market_symbol_demo' && empty(trim((string) ($validated['symbol'] ?? '')))) {
            return response()->json(['message' => 'symbol is required for market_symbol_demo'], 422);
        }

        if (! PythonEngineClient::isConfigured()) {
            return response()->json([
                'message' => 'Python engine trigger is not configured (PYTHON_ENGINE_URL + ENGINE_INTERNAL_TRIGGER_SECRET).',
            ], 503);
        }

        $payload = array_filter($validated, static fn ($v) => $v !== null && $v !== '');

        $result = PythonEngineClient::postInternal('/internal/tasks/data-backfill', $payload);

        if (($result['ok'] ?? false) !== true && ($result['accepted'] ?? false) !== true) {
            $status = (int) ($result['status'] ?? 502);

            return response()->json([
                'message' => is_string($result['error'] ?? null)
                    ? $result['error']
                    : 'Failed to start backfill on python_engine',
                'detail' => $result,
            ], $status >= 400 && $status < 600 ? $status : 502);
        }

        return response()->json([
            'data' => [
                'accepted' => true,
                'job' => $validated['job'],
                'params' => array_diff_key($payload, ['job' => true]),
                'message' => 'Job queued on python_engine. Check Admin → Logs (Python) for progress.',
            ],
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fallbackCatalog(): array
    {
        return [
            [
                'id' => 'market_symbol',
                'label' => 'Catch up chart OHLC (one symbol)',
                'description' => 'Yahoo daily → instrument_data (production charts).',
                'module' => 'stock_sync.DSATurbo',
            ],
            [
                'id' => 'demo_board_refill',
                'label' => 'Catch up demo board (10 symbols)',
                'description' => 'Last N days for fixed demo symbols in instrument_data.',
                'module' => 'stock_sync.DSATurbo',
            ],
            [
                'id' => 'demo_sync_all',
                'label' => 'Demo universe sync',
                'description' => 'Sync all symbols in snapshot_demo.',
                'module' => 'demo_data_sync.DSADemoSync.run',
            ],
            [
                'id' => 'news_backfill',
                'label' => 'News history backfill',
                'description' => 'GDELT + corporate actions → knowledge_docs.',
                'module' => 'news_handle.run_deep_news_backfill',
            ],
        ];
    }
}
