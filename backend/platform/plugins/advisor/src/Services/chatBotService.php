<?php

namespace Platform\Plugins\Advisor\Src\Services;

use Platform\Plugins\Advisor\Src\LanguageSmoother;
use Platform\Plugins\Advisor\Src\DTO\SmoothContext;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\KnowledgeRepository;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\StockRepository;
use Platform\Plugins\Advisor\Src\Services\ResponseComposerService;
use Platform\Plugins\Trading\Src\Services\AnalysistService;
use Platform\Plugins\Trading\Src\Services\IndicatorAggregatorService;
use Platform\Plugins\Advisor\Src\Services\EmbeddingService;
use Platform\Plugins\Advisor\Src\Services\Context\QdrantRetriever;
use Illuminate\Support\Facades\Log;

class ChatBotService
{
    public function __construct(
        private readonly LanguageSmoother $smoother,
        private readonly KnowledgeRepository $knowledgeRepository,
        private readonly StockRepository $stockRepository,
        private readonly IndicatorAggregatorService $indicatorAggregatorService,
        private readonly AnalysistService $analysistService,
        private readonly ResponseComposerService $responseComposerService,
        private readonly EmbeddingService $embeddingService,
        private readonly QdrantRetriever $qdrantRetriever,
    ) {
    }

    /* =========================================================
     | PUBLIC ENTRY POINTS
     ========================================================= */

    /**
     * Chat-only (text response)
     */
    public function chat(array $data): array
    {
        $message = $data['message'];
        $options = $this->extractOptions($data);

        /* =========================
         | 1) NLP INBOUND
         ========================= */
        $in = $this->smoother->smooth(
            $message,
            new SmoothContext(
                direction: 'in',
                stylePreset: $options['stylePreset'],
                locale: 'en'
            )
        );

        // 🔎 READ-ONLY NLP OUTPUT
        $sentenceTree = $in->notes['sentence_tree'] ?? [];
        $decisionNote = $in->notes['decision'] ?? [];

        $negatedTargets = $sentenceTree['modifiers']['negated'] ?? [];
        $constraints = $in->constraints ?? [];

        Log::info('ChatBotService::chat IN', [
            'cleanText' => $in->cleanText,
            'intent' => $in->intent,
            'entities' => $in->entities,
            'negated' => $negatedTargets,
            'constraints' => $constraints,
        ]);

        /* =========================
         | 2) ROUTE
         ========================= */
        [$rawReply, $meta] = $this->route(
            $in->cleanText,
            $in->intent,
            $in->entities,
            $options
        );

        /**
         * 🔐 IMPORTANT:
         * If router already returns a structured object
         * → DO NOT pass through NLP outbound
         */
        if (is_array($rawReply)) {
            return [
                'reply' => $rawReply,
                'debug' => [
                    'intent' => $in->intent,
                    'entities' => $in->entities,
                    'negated' => $negatedTargets,
                    'constraints' => $constraints,
                    'meta' => $meta,
                ],
            ];
        }

        /* =========================
         | 3) NLP OUTBOUND (TEXT ONLY)
         ========================= */
        $out = $this->smoother->smooth(
            $rawReply,
            new SmoothContext(
                direction: 'out',
                stylePreset: $options['stylePreset'],
                locale: 'en',
                memory: [
                    'profile' => $options['profile'],
                    'intent' => $in->intent,
                    'constraints' => $constraints,
                ]
            )
        );

        return [
            'reply' => $out->cleanText,
            'debug' => [
                'intent' => $in->intent,
                'entities' => $in->entities,
                'negated' => $negatedTargets,
                'constraints' => $constraints,
                'meta' => $meta,
            ],
        ];
    }

    /**
     * Analysis / advisory API (JSON)
     */
    public function analysis(array $data)
    {
        $chat = $this->chat($data);

        $intent = $chat['debug']['intent'] ?? 'fallback';
        $entities = $chat['debug']['entities'] ?? [];
        $tickers = $entities['tickers'] ?? [];
        $analysisIntents = ['analysis_request', 'buy_decision', 'sell_decision'];

        // ✅ NOT analysis intent → return chat reply directly
        if (!in_array($intent, $analysisIntents, true)) {
            // ✅ if reply is structured object (news/definition/...)
            if (is_array($chat['reply'])) {
                return response()->json($chat['reply']);
            }

            // ✅ normal text chat
            return response()->json([
                'type' => 'chat',
                'response' => $chat['reply'],
            ]);
        }

        // analysis intent but no ticker
        if (empty($tickers)) {
            return response()->json([
                'type' => 'chat',
                'response' => "Which ticker should I analyze?",
            ]);
        }

        $results = $this->analyzeTickers(
            $tickers,
            $data['period'] ?? 'daily',
            $this->extractOptions($data),
            $chat['debug']['constraints'] ?? []
        );

        return response()->json([
            'type' => count($results) > 1 ? 'advice_multi' : 'advice',
            'period' => $data['period'] ?? 'daily',
            'results' => $results,
        ]);
    }

    /**
     * Direct advisory (single symbol)
     */
    public function advise(array $data)
    {
        $results = $this->analyzeTickers(
            [$data['symbol']],
            $data['period'] ?? 'daily',
            $this->extractOptions($data),
            []
        );

        return response()->json($results[0] ?? []);
    }

    /* =========================================================
     | CORE ANALYSIS ENGINE (SINGLE SOURCE OF TRUTH)
     ========================================================= */

    private function analyzeTickers(
        array $tickers,
        string $period,
        array $options,
        array $constraints = []
    ): array {
        $results = [];

        foreach ($tickers as $rawSymbol) {
            $symbol = strtoupper($rawSymbol);

            try {
                $summary = $this->analysistService
                    ->Indicator_Summary($symbol, $period)
                    ->getData(true);

                $decision = $this->indicatorAggregatorService->aggregate(
                    $summary,
                    (float) $summary['price']
                );

                $response = $this->responseComposerService->compose(
                    $decision,
                    [
                        'profile' => $options['profile'],
                        'style' => $options['stylePreset'],
                        'constraints' => $constraints, // 👈 explanation on/off
                    ]
                );

                $results[] = [
                    'symbol' => $symbol,
                    'response' => $response,
                ];
            } catch (\Throwable $e) {
                Log::error("Advisor failed for {$symbol}", [
                    'error' => $e->getMessage(),
                ]);

                $results[] = [
                    'symbol' => $symbol,
                    'error' => 'Unable to retrieve advisory data at this time.',
                ];
            }
        }

        return $results;
    }

    /* =========================================================
     | ROUTER
     ========================================================= */

    private function route(
        string $cleanText,
        ?string $intent,
        array $entities,
        array $options
    ): array {
        return match ($intent) {
            'news_request' => [
                $this->replyNews($entities),
                ['intent' => 'news_request'],
            ],

            'price_request' => [
                $this->replyPrice($entities),
                ['intent' => 'price_request'],
            ],

            'buy_decision' => [
                $this->replyDecision($entities, 'buy', $options),
                ['intent' => 'buy_decision'],
            ],

            'sell_decision' => [
                $this->replyDecision($entities, 'sell', $options),
                ['intent' => 'sell_decision'],
            ],

            default => [
                "I can help with market news, prices, analysis, or explanations. What would you like to do?",
                ['intent' => 'fallback'],
            ],
        };
    }

    /* =========================================================
     | REPLY HELPERS (array ONLY)
     ========================================================= */

    private function replyNews(array $entities): array
    {
        $tickers = $entities['tickers'] ?? [];
        \Log::info('ChatBotService::replyNews', ['tickers' => $tickers]);

        if (empty($tickers)) {
            return [
                'type' => 'chat',
                'response' => ['message' => 'Which ticker or company should I search the news for?'],
            ];
        }

        $symbol = strtoupper($tickers[0]);
        $query = "latest news about {$symbol}";

        // 1) embed -> vector
        $embed = $this->embeddingService->embed($query);
        $vector = $embed['vector'] ?? $embed ?? null;

        if (!is_array($vector) || empty($vector)) {
            return [
                'type' => 'chat',
                'response' => ['message' => 'Embedding service is not available at the moment.'],
            ];
        }

        // 2) qdrant search (already returns result array)
        $hits = $this->qdrantRetriever->search($vector, 5, $symbol);

        if (empty($hits)) {
            return [
                'type' => 'news',
                'response' => [
                    'summary' => "No relevant news found for {$symbol}.",
                    'items' => [],
                ],
            ];
        }

        // 3) collect chunk ids from qdrant (payload.chunk_id preferred)
        $chunkIds = collect($hits)->map(function ($hit) {
            $p = $hit['payload'] ?? [];
            return $p['chunk_id'] ?? ($hit['id'] ?? null);
        })->filter()->unique()->values()->all();

        // 4) query DB: knowledge_chunks + knowledge
        // ⚠️ adjust selected fields if your knowledge table uses url_slug instead of url
        $rows = \DB::table('knowledge_chunks as kc')
            ->leftJoin('knowledge as k', 'k.id', '=', 'kc.knowledge_id')
            ->whereIn('kc.id', $chunkIds)
            ->select([
                'kc.id as chunk_id',
                'kc.knowledge_id',
                'kc.docs_id',
                'kc.content as chunk_content',
                'kc.source as chunk_source',
                'k.topic as topic',
                'k.url_slug as url_slug',
                'k.published_at as published_at',
                'k.created_at as created_at',
            ])
            ->get()
            ->keyBy('chunk_id');

        // 5) build items in qdrant order
        $items = collect($hits)->map(function ($hit) use ($rows) {
            $p = $hit['payload'] ?? [];
            $chunkId = $p['chunk_id'] ?? ($hit['id'] ?? null);
            $row = $chunkId ? ($rows[$chunkId] ?? null) : null;

            $topic = $row?->topic ?? ($p['title'] ?? ($p['source'] ?? 'News'));

            // best excerpt: chunk_content (DB) > payload.content (if ever added)
            $content = $row?->chunk_content ?? ($p['content'] ?? null);

            // best source: DB chunk_source > payload.source
            $source = $row?->chunk_source ?? ($p['source'] ?? null);

            // published_at may be null; fallback created_at
            $publishedAt = $row?->published_at ?? $row?->created_at ?? ($p['published_at'] ?? null);

            // if you want full URL later: build from url_slug
            $url = $row?->url_slug ?? ($p['url'] ?? null);

            return [
                'id' => $chunkId,
                'topic' => $topic,
                'excerpt' => $content ? str($content)->limit(300)->toString() : null,
                'published_at' => $publishedAt,
                'source' => $source,
                'url' => $url,
                'score' => $hit['score'] ?? null,
            ];
        })->values();

        return [
            'type' => 'news',
            'response' => [
                'summary' => "Here are the most relevant updates about {$symbol}.",
                'items' => $items,
            ],
        ];
    }

    private function replyPrice(array $entities): string
    {
        $tickers = $entities['tickers'] ?? [];
        \Log::info('ChatBotService::replyPrice', ['tickers' => $tickers]);

        foreach ($tickers as $symbol) {
            $price = $this->stockRepository->getCurrentPrice($symbol);
            if ($price !== null) {
                return "The current price for {$symbol} is \${$price}.";
            }
        }

        return "Price data is not available at the moment.";
    }

    private function replyDecision(
        array $entities,
        string $action,
        array $options
    ): string {
        $tickers = $entities['tickers'] ?? [];

        if (empty($tickers)) {
            return "Which ticker are you considering to {$action}?";
        }

        $results = $this->analyzeTickers($tickers, 'daily', $options);

        $messages = [];
        foreach ($results as $r) {
            if (isset($r['error'])) {
                $messages[] = "{$r['symbol']}: {$r['error']}";
            } else {
                // ✅ CHỈ LẤY MESSAGE (string)
                $text = is_array($r['response'])
                    ? ($r['response']['message'] ?? '')
                    : $r['response'];

                $messages[] = "{$r['symbol']}:\n{$text}";
            }
        }

        return implode("\n\n", $messages);
    }


    /* =========================================================
     | UTIL
     ========================================================= */

    private function extractOptions(array $data): array
    {
        return [
            'profile' => $data['profile'] ?? 'spoken_professional',
            'stylePreset' => $data['stylePreset'] ?? 'standard',
        ];
    }
}
