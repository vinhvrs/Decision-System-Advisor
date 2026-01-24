<?php

namespace Platform\Plugins\Advisor\Src\Http\Controllers;

use Illuminate\Http\Request;
use Platform\Plugins\Advisor\Src\Services\ChatBotService;
use App\Http\Controllers\Controller;

class ChatBotController extends Controller
{
    public function __construct(
        private readonly ChatBotService $chatBotService
    ) {}

    public function chat(Request $request)
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
            'profile' => ['nullable', 'string'],      // spoken_casual | spoken_professional | written_standard | written_formal
            'stylePreset' => ['nullable', 'string'],  // concise | standard | detailed
            'debug'   => ['nullable', 'boolean'],
        ]);

        $result = $this->chatBotService->chat(
            $data['message'],
            [
                'profile' => $data['profile'] ?? 'spoken_professional',
                'stylePreset' => $data['stylePreset'] ?? 'standard',
            ]
        );

        // nếu không muốn trả debug ra client, tắt bằng request debug=false
        if (!($data['debug'] ?? false)) {
            unset($result['debug']);
        }

        return response()->json($result);
    }
}
