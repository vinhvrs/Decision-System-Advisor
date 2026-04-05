<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use App\Services\LaravelLogParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LogViewerController extends Controller
{
    public function show(): JsonResponse
    {
        $maxBytes = max(4096, min((int) config('admin_logs.max_bytes', 120_000), 500_000));

        $php = $this->tailFile((string) config('admin_logs.php'), $maxBytes);
        $python = $this->tailFile((string) config('admin_logs.python'), $maxBytes);
        $frontend = $this->tailFile((string) config('admin_logs.frontend'), $maxBytes);

        return response()->json([
            'data' => [
                'php' => $php['text'],
                'python' => $python['text'],
                'frontend' => $frontend['text'],
                'paths' => [
                    'php' => $php['path'],
                    'python' => $python['path'],
                    'frontend' => $frontend['path'],
                ],
                'readable' => [
                    'php' => $php['readable'],
                    'python' => $python['readable'],
                    'frontend' => $frontend['readable'],
                ],
                'truncated_bytes' => $maxBytes,
            ],
        ]);
    }

    /**
     * Structured lines from the Laravel log (errors, warnings, etc.).
     */
    public function laravelEntries(Request $request, LaravelLogParser $parser): JsonResponse
    {
        $maxBytes = max(8192, min((int) config('admin_logs.max_bytes', 120_000), 500_000));
        $path = (string) config('admin_logs.php');
        $text = $this->readTailRaw($path, $maxBytes);

        $levelsParam = $request->query('levels');
        $levels = null;
        if (is_string($levelsParam) && $levelsParam !== '') {
            $levels = array_values(array_filter(array_map(
                static fn (string $s) => strtoupper(trim($s)),
                explode(',', $levelsParam)
            )));
        }

        $limit = min(1000, max(50, (int) $request->query('limit', 400)));

        $entries = $parser->parseTail($text, $limit, $levels === [] ? null : $levels);

        return response()->json([
            'data' => [
                'entries' => $entries,
                'path' => $path,
                'truncated_bytes' => $maxBytes,
            ],
        ]);
    }

    /**
     * Admin / staff actions and optional filters.
     */
    public function activity(Request $request): JsonResponse
    {
        $perPage = min(100, max(5, (int) $request->query('per_page', 25)));

        $query = AdminActivityLog::query()
            ->with(['user:id,name,email,username'])
            ->orderByDesc('created_at');

        if ($request->filled('level')) {
            $query->where('level', $request->query('level'));
        }
        if ($request->filled('channel')) {
            $query->where('channel', $request->query('channel'));
        }
        if ($request->filled('search')) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $request->query('search')).'%';
            $query->where('message', 'like', $s);
        }

        return response()->json($query->paginate($perPage));
    }

    private function readTailRaw(string $path, int $maxBytes): string
    {
        $tail = $this->tailFile($path, $maxBytes);

        return $tail['text'];
    }

    /**
     * @return array{text: string, path: string, readable: bool}
     */
    private function tailFile(string $path, int $maxBytes): array
    {
        $path = $path === '' ? '' : $path;

        if ($path === '' || ! is_file($path) || ! is_readable($path)) {
            $hint = $path === ''
                ? 'Set ADMIN_LOG_* in .env'
                : 'File missing or not readable by PHP (check path and permissions).';

            return [
                'text' => "[{$hint}]\nConfigured path: ".($path ?: '(empty)'),
                'path' => $path,
                'readable' => false,
            ];
        }

        $size = filesize($path);
        if ($size === false || $size === 0) {
            return [
                'text' => '(empty log file)',
                'path' => $path,
                'readable' => true,
            ];
        }

        $start = max(0, $size - $maxBytes);
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            return [
                'text' => '(could not open file)',
                'path' => $path,
                'readable' => false,
            ];
        }

        fseek($handle, $start);
        $chunk = fread($handle, $maxBytes);
        fclose($handle);

        $text = $chunk === false ? '' : $chunk;
        $text = Str::of($text)->replace("\0", '')->toString();

        if (! mb_check_encoding($text, 'UTF-8')) {
            $text = mb_convert_encoding($text, 'UTF-8', 'UTF-8');
        }

        if ($start > 0) {
            $text = "… (showing last ~{$maxBytes} bytes)\n".$text;
        }

        return [
            'text' => $text,
            'path' => $path,
            'readable' => true,
        ];
    }
}
