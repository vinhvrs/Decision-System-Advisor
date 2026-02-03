<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class ComposeResponse
{
    protected array $phrases;
    protected array $profiles;

    public function __construct(array $phrases, array $profiles = [])
    {
        $this->phrases  = $phrases;
        $this->profiles = $profiles;
    }

    /**
     * Main response composer
     */
    public function handle(string $text, SmoothContext $ctx, ?string $intent): string
    {
        $decision = $ctx->memory['decision'] ?? [];
        $strategy = $decision['strategy'] ?? [];

        // 1️⃣ Nếu cần data nhưng thiếu entity
        if (($strategy['require_data'] ?? false) && empty($decision['entities'])) {
            return $this->fallbackMissingEntity();
        }

        // 2️⃣ Nếu không cho phép LLM / phrasing
        if (($strategy['allow_llm'] ?? false) === false) {
            return $text;
        }

        // 3️⃣ Compose phrased response
        $prefix   = $this->pickPrefix($ctx, $strategy);
        $body     = $this->pickIntentPhrase($intent);
        $followUp = $this->pickFollowUp($ctx);

        return trim(
            implode(' ', array_filter([
                $prefix,
                $body ?: $text,
                $followUp,
            ]))
        );
    }

    /**
     * Pick prefix based on style / strategy mode
     */
    protected function pickPrefix(SmoothContext $ctx, array $strategy): string
    {
        $mode = $strategy['mode']
            ?? $ctx->stylePreset
            ?? 'default';

        $group = $this->phrases['prefix'][$mode]
            ?? $this->phrases['prefix']['default']
            ?? [];

        return $this->randomFrom($group);
    }

    /**
     * Pick phrase based on intent
     */
    protected function pickIntentPhrase(?string $intent): ?string
    {
        if (!$intent) {
            return null;
        }

        $group = $this->phrases[$intent]
            ?? $this->phrases['unknown']
            ?? [];

        return $this->randomFrom($group);
    }

    /**
     * Optional follow-up (only for inbound-like responses)
     */
    protected function pickFollowUp(SmoothContext $ctx): ?string
    {
        if ($ctx->direction !== 'out') {
            return null;
        }

        if (empty($this->phrases['follow_up'])) {
            return null;
        }

        return $this->randomFrom($this->phrases['follow_up']);
    }

    /**
     * Fallback when entity is missing
     */
    protected function fallbackMissingEntity(): string
    {
        return "Please specify a stock, company, or market so I can continue.";
    }

    /**
     * Random helper
     */
    protected function randomFrom(array $items): ?string
    {
        if (empty($items)) {
            return null;
        }

        return $items[array_rand($items)];
    }
}
