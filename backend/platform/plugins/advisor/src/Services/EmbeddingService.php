<?php

namespace Platform\Plugins\Advisor\Src\Services;

use Illuminate\Support\Facades\Http;

class EmbeddingService
{
    public function embed(string $text): array
    {
        $res = Http::timeout(20)->post(config('services.embedding.url') . '/embed', [
            'text' => $text,
        ]);

        if (!$res->successful()) {
            throw new \RuntimeException("Embedding service error: " . $res->body());
        }

        return $res->json();
    }
}