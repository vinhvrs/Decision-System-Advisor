<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class ComposeResponse
{
    public function __construct(
        private array $phrases,
        private array $profiles,
    ) {
    }

    public function handle(string $rawText, SmoothContext $ctx, ?string $intent = null): string
    {
        $defaultProfile = $this->profiles['default_profile'] ?? 'spoken_professional';
        $profileName = $ctx->memory['profile'] ?? $defaultProfile;

        $profiles = $this->profiles['profiles'] ?? [];
        $profile = $profiles[$profileName] ?? ($profiles[$defaultProfile] ?? [
            'use_contractions' => true,
            'max_sentences' => 10,
            'structure' => 'standard',
        ]);


        $opener = $this->pick($this->phrases['openers'][$profileName] ?? []);
        $closer = $this->pick($this->phrases['closers'][$profileName] ?? []);

        $followUpPool = $this->phrases['follow_up_questions'][$intent ?? 'default']
            ?? $this->phrases['follow_up_questions']['default'];

        $followUp = $profile['structure'] !== 'formal'
            ? $this->pick($followUpPool)
            : null;

        // basic formatting: keep rawText as body
        $parts = array_filter([
            $opener,
            trim($rawText),
            $followUp ? $followUp : null,
            $closer,
        ]);

        $text = implode("\n\n", $parts);

        // contractions control (very lightweight)
        if (!$profile['use_contractions']) {
            $text = str_replace(["I'm", "you're", "don't", "can't"], ["I am", "you are", "do not", "cannot"], $text);
        }

        return $text;
    }

    private function pick(array $arr): ?string
    {
        if (empty($arr))
            return null;
        return $arr[array_rand($arr)];
    }
}
