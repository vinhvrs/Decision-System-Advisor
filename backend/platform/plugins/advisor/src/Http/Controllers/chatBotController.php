<?php

namespace Platform\Plugins\Advisor\Src\Http\Controllers;

use Illuminate\Http\Request;
use Platform\Plugins\Advisor\Src\Services\ChatBotService;
use Platform\Plugins\Advisor\Src\Services\ResponseComposerService;
use Platform\Plugins\Trading\Src\Services\AnalysistService;
use Platform\Plugins\Trading\Src\Services\IndicatorAggregatorService;
use App\Http\Controllers\Controller;

class ChatBotController extends Controller
{
    public function __construct(
        private readonly ChatBotService $chatBotService,
        private readonly IndicatorAggregatorService $indicatorAggregatorService,
        private readonly AnalysistService $analysistService,
        private readonly ResponseComposerService $responseComposerService
    ) {
    }

    public function chat(Request $request)
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
            'profile' => ['nullable', 'string'],
            'stylePreset' => ['nullable', 'string'],
            'debug' => ['nullable', 'boolean'],
        ]);

        // 1. NLP / intent parsing
        $chatResult = $this->chatBotService->chat(
            $data['message'],
            [
                'profile' => $data['profile'] ?? 'spoken_professional',
                'stylePreset' => $data['stylePreset'] ?? 'standard',
            ]
        );

        // 3 routes: news, analysis, price advice, or general chat (asking defintions,...')


        $tickers = $chatResult['debug']['entities']['tickers'] ?? [];

        if (!empty($tickers)) {
            $period = 'daily';
            $results = [];

            foreach ($tickers as $rawSymbol) {
                $symbol = strtoupper($rawSymbol);

                try {
                    // 2. Indicator summary
                    $summary = $this->analysistService
                        ->Indicator_Summary($symbol, $period)
                        ->getData(true);

                    // 3. Decision engine
                    $decision = $this->indicatorAggregatorService->aggregate(
                        $summary,
                        (float) $summary['price']
                    );

                    // 4. Response composer
                    $response = $this->responseComposerService->compose(
                        $decision,
                        [
                            'profile' => $data['profile'] ?? 'spoken_professional',
                            'style' => $data['stylePreset'] ?? 'standard',
                        ]
                    );

                    $results[] = [
                        'symbol' => $symbol,
                        'response' => $response,
                    ];
                } catch (\Throwable $e) {
                    // Không để 1 ticker lỗi làm sập cả câu hỏi
                    \Log::error("Advisor failed for {$symbol}: {$e->getMessage()}");

                    $results[] = [
                        'symbol' => $symbol,
                        'error' => 'Unable to retrieve advisory data at this time.',
                    ];
                }
            }

            return response()->json([
                'type' => count($results) > 1 ? 'advice_multi' : 'advice',
                'period' => $period,
                'results' => $results,
            ]);
        }

        // 5. Fallback: chat thường
        if (!($data['debug'] ?? false)) {
            unset($chatResult['debug']);
        }

        return response()->json([
            'type' => 'chat',
            'response' => $chatResult,
        ]);
    }

    public function advise(Request $request)
    {
        $data = $request->validate([
            'symbol' => ['required', 'string'],
            'period' => ['nullable', 'string'],
            'profile' => ['nullable', 'string'],      // spoken_casual | spoken_professional | written_standard | written_formal
            'stylePreset' => ['nullable', 'string'],  // concise | standard | detailed
        ]);

        $period = $data['period'] ?? 'daily';

        $summary = $this->analysistService
            ->Indicator_Summary($data['symbol'], $period)
            ->getData(true);

        $decision = $this->indicatorAggregatorService->aggregate(
            $summary,
            (float) $summary['price']
        );

        $response = $this->responseComposerService->compose(
            $decision,
            [
                'profile' => $data['profile'] ?? 'spoken_professional',
                'style' => $data['stylePreset'] ?? 'standard',
            ]
        );

        return response()->json($response);

    }
}
