<?php

namespace Platform\Plugins\Advisor\Src\Http\Controllers;

use Illuminate\Http\Request;
use Platform\Plugins\Advisor\Src\Services\ChatBotService;
use App\Http\Controllers\Controller;

class ChatBotController extends Controller
{
    public function __construct(
        private readonly ChatBotService $chatBotService,
    ) {}

    /**
     * Chat endpoint
     * - If message contains ticker → advisory
     * - Otherwise → normal chat / knowledge reply
     */
    public function chat(Request $request)
    {
        $data = $request->validate([
            'message'     => ['required', 'string', 'max:5000'],
            'profile'     => ['nullable', 'string'],
            'stylePreset' => ['nullable', 'string'],
            'debug'       => ['nullable', 'boolean'],
            'timeframe'   => ['nullable', 'string'],
        ]);

        // Normalize timeframe → period (service-level contract)
        $data['period'] = $data['timeframe'] ?? 'daily';

        return $this->chatBotService->analysis($data);
    }

    /**
     * Direct advisory endpoint (explicit symbol)
     */
    public function advise(Request $request)
    {
        $data = $request->validate([
            'symbol'      => ['required', 'string', 'max:10'],
            'timeframe'   => ['nullable', 'string'],
            'profile'     => ['nullable', 'string'],
            'stylePreset' => ['nullable', 'string'],
            'debug'       => ['nullable', 'boolean'],
        ]);

        // Normalize timeframe → period
        $data['period'] = $data['timeframe'] ?? 'daily';

        return $this->chatBotService->advise($data);
    }
}
