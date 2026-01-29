<?php

namespace Platform\Plugins\Advisor\Src\Rules;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class ComposeResponse
{
    public function __construct(
        protected array $phrases
    ) {}

    public function handle(string $text, SmoothContext $ctx, ?string $intent): string
    {
        $style = $ctx->stylePreset ?? 'default';

        $prefixes = $this->phrases['prefix'][$style]
            ?? $this->phrases['prefix']['default'];

        $prefix = $prefixes[array_rand($prefixes)];

        return trim($prefix . ' ' . $text);
    }
}
