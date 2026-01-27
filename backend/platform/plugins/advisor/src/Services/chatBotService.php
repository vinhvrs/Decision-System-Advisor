<?php

namespace Platform\Plugins\Advisor\Src\Services;

use Platform\Plugins\Advisor\Src\LanguageSmoother;
use Platform\Plugins\Advisor\Src\DTO\SmoothContext;
use Illuminate\Support\Facades\Log;

class ChatBotService
{
    public function __construct(
        private readonly LanguageSmoother $smoother,
    ) {}

    /**
     * Main entry: process user message -> return smooth response + metadata
     */
    public function chat(string $message, array $options = []): array
    {
        // 1) Smooth inbound (normalize, entity, intent)
        $in = $this->smoother->smooth(
            $message,
            new SmoothContext(direction: 'in', stylePreset: 'standard', locale: 'en')
        );

        \Log::info('ChatBotService::chat IN', [
            'cleanText' => $in->cleanText,
            'intent'    => $in->intent,
            'entities'  => $in->entities,
        ]);

        // 2) Router (demo). Bạn thay bằng logic gọi API/DB/LLM thật
        [$rawReply, $meta] = $this->route($in->cleanText, $in->intent, $in->entities, $options);

        // 3) Smooth outbound (human-like response composer + postprocess)
        $out = $this->smoother->smooth(
            $rawReply,
            new SmoothContext(
                direction: 'out',
                stylePreset: $options['stylePreset'] ?? 'standard',
                locale: 'en',
                memory: [
                    'profile' => $options['profile'] ?? 'spoken_professional',
                    'intent'  => $in->intent,
                ]
            )
        );

        return [
            'reply' => $out->cleanText,
            'debug' => [
                'cleanText' => $in->cleanText,
                'intent'    => $in->intent,
                'entities'  => $in->entities,
                'meta'      => $meta,
            ],
        ];
    }

    /**
     * Very simple router stub. Replace with your real tool calls:
     * - news_search: call NewsService
     * - price_check: call MarketService
     * - explain_term: call KnowledgeBase/RAG
     */
    private function route(string $cleanText, ?string $intent, array $entities, array $options): array
    {
        $intent = $intent ?? 'default';

        // demo reply by intent
        return match ($intent) {
            'news_search' => [
                $this->replyNews($cleanText, $entities),
                ['intent' => 'news_search'],
            ],
            'price_check' => [
                $this->replyPrice($cleanText, $entities),
                ['intent' => 'price_check'],
            ],
            'compare' => [
                "I can compare the two assets if you tell me which criteria you care about (valuation, growth, risk, or recent news).",
                ['intent' => 'compare'],
            ],
            default => [
                "I can help with market news, prices, comparisons, or explanations. What would you like to do?",
                ['intent' => 'default'],
            ],
        };
    }

    private function replyNews(string $cleanText, array $entities): string
    {
        $ticker = $entities['tickers'][0] ?? null;

        if (!$ticker) {
            return "Which ticker or company should I search the news for?";
        }

        // TODO: replace by real News API fetch + summarization
        return "Here are the latest updates for {$ticker}. (Demo) I can also filter by trusted sources and timeframe if you want.";
    }

    private function replyPrice(string $cleanText, array $entities): string
    {
        $ticker = $entities['tickers'][0] ?? null;

        if (!$ticker) {
            return "Which ticker should I check the price for (e.g., AAPL, NVDA)?";
        }

        // TODO: replace by real market data fetch
        return "The current price for {$ticker} is not connected yet (Demo). Do you want real-time or close price?";
    }
}
