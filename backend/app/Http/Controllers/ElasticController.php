<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Elastic\ElasticCompanyProfileService;
use App\Services\Elastic\ElasticCompanySearchService;
use App\Services\Elastic\ElasticKnowledgeDocService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Throwable;

class ElasticController extends Controller
{
    public function __construct(
        protected ElasticCompanyProfileService $companyProfileService,
        protected ElasticCompanySearchService $companySearchService,
        protected ElasticKnowledgeDocService $knowledgeDocService
    ) {}

    /**
     * Health check for Elasticsearch cluster.
     */
    public function health(): JsonResponse
    {
        try {
            $ttl = (int) config('performance.elastic_health_ttl', 10);
            $health = Cache::remember('elastic.health.v1', max(1, $ttl), function () {
                return $this->companySearchService->health();
            });

            return response()->json([
                'success' => true,
                'data' => $health,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Elasticsearch unreachable.',
                'error' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * Search companies by name or symbol (simplified API).
     * GET /elastic/search?q=aapl&size=20
     */
    public function search(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'q' => ['required', 'string', 'max:200'],
                'size' => ['nullable', 'integer', 'min:1', 'max:50'],
                'from' => ['nullable', 'integer', 'min:0'],
            ]);

            $ttl = (int) config('performance.elastic_get_ttl', 60);
            $cacheKey = 'elastic.simple_search.v1:' . md5(json_encode($validated));
            $result = Cache::remember($cacheKey, max(1, $ttl), function () use ($validated) {
                return $this->companySearchService->search(
                    query: $validated['q'],
                    size: (int) ($validated['size'] ?? 20),
                    from: (int) ($validated['from'] ?? 0),
                );
            });

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Search failed.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function searchCompanies(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'q' => ['nullable', 'string'],
                'symbol' => ['nullable', 'string'],
                'sector' => ['nullable', 'string'],
                'industry' => ['nullable', 'string'],
                'exchange' => ['nullable', 'string'],
                'country' => ['nullable', 'string'],
                'size' => ['nullable', 'integer', 'min:1', 'max:100'],
                'from' => ['nullable', 'integer', 'min:0'],
            ]);

            $ttl = (int) config('performance.elastic_get_ttl', 60);
            $cacheKey = 'elastic.companies_search.v1:' . md5(json_encode($validated));
            $result = Cache::remember($cacheKey, max(1, $ttl), function () use ($validated) {
                return $this->companyProfileService->search(
                    query: $validated['q'] ?? '',
                    symbol: $validated['symbol'] ?? null,
                    sector: $validated['sector'] ?? null,
                    industry: $validated['industry'] ?? null,
                    exchange: $validated['exchange'] ?? null,
                    country: $validated['country'] ?? null,
                    size: (int) ($validated['size'] ?? 10),
                    from: (int) ($validated['from'] ?? 0),
                );
            });

            return response()->json([
                'success' => true,
                'message' => 'Company profiles fetched successfully.',
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to search company profiles.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function searchKnowledgeDocs(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'q' => ['nullable', 'string'],
                'symbol' => ['nullable', 'string'],
                'category' => ['nullable', 'string'],
                'source' => ['nullable', 'string'],
                'language' => ['nullable', 'string'],
                'is_processed' => ['nullable'],
                'size' => ['nullable', 'integer', 'min:1', 'max:100'],
                'from' => ['nullable', 'integer', 'min:0'],
            ]);

            $isProcessed = null;
            if ($request->has('is_processed')) {
                $raw = $request->query('is_processed');
                $isProcessed = filter_var($raw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

                if ($isProcessed === null && is_numeric($raw)) {
                    $isProcessed = ((int) $raw) === 1;
                }
            }

            $validatedWithFlag = array_merge($validated, ['_is_processed' => $isProcessed]);
            $ttl = (int) config('performance.elastic_get_ttl', 60);
            $cacheKey = 'elastic.knowledge_search.v1:' . md5(json_encode($validatedWithFlag));
            $result = Cache::remember($cacheKey, max(1, $ttl), function () use ($validated, $isProcessed) {
                return $this->knowledgeDocService->search(
                    query: $validated['q'] ?? '',
                    symbol: $validated['symbol'] ?? null,
                    category: $validated['category'] ?? null,
                    source: $validated['source'] ?? null,
                    language: $validated['language'] ?? null,
                    isProcessed: $isProcessed,
                    size: (int) ($validated['size'] ?? 10),
                    from: (int) ($validated['from'] ?? 0),
                );
            });

            return response()->json([
                'success' => true,
                'message' => 'Knowledge documents fetched successfully.',
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to search knowledge documents.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function reindexCompanies(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'chunk' => ['nullable', 'integer', 'min:1', 'max:5000'],
            ]);

            $result = $this->companyProfileService->reindexAll(
                (int) ($validated['chunk'] ?? 200)
            );

            Cache::forget('elastic.health.v1');

            return response()->json([
                'success' => true,
                'message' => 'Company profiles reindexed successfully.',
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to reindex company profiles.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function reindexKnowledgeDocs(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'chunk' => ['nullable', 'integer', 'min:1', 'max:5000'],
            ]);

            $result = $this->knowledgeDocService->reindexAll(
                (int) ($validated['chunk'] ?? 200)
            );

            Cache::forget('elastic.health.v1');

            return response()->json([
                'success' => true,
                'message' => 'Knowledge documents reindexed successfully.',
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to reindex knowledge documents.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function companyBySymbol(string $symbol): JsonResponse
    {
        try {
            $sym = strtolower($symbol);
            $ttl = (int) config('performance.elastic_get_ttl', 60);
            $result = Cache::remember("elastic.company_symbol.v1:{$sym}", max(1, $ttl), function () use ($symbol) {
                return $this->companyProfileService->findBySymbol($symbol);
            });

            return response()->json([
                'success' => true,
                'message' => 'Company profile fetched successfully.',
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch company profile by symbol.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function knowledgeDocsBySymbol(string $symbol, Request $request): JsonResponse
    {
        try {
            $size = (int) $request->query('size', 10);
            $sym = strtolower($symbol);
            $ttl = (int) config('performance.elastic_get_ttl', 60);
            $cacheKey = "elastic.knowledge_by_symbol.v1:{$sym}:{$size}";
            $result = Cache::remember($cacheKey, max(1, $ttl), function () use ($symbol, $size) {
                return $this->knowledgeDocService->searchBySymbol($symbol, $size);
            });

            return response()->json([
                'success' => true,
                'message' => 'Knowledge documents by symbol fetched successfully.',
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch knowledge documents by symbol.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}