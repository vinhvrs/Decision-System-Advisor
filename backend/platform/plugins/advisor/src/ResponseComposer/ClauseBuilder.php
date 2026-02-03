<?php

namespace Platform\Plugins\Advisor\Src\ResponseComposer;

class ClauseBuilder
{
    public static function pick(array $phrases, string $seed): string
    {
        // deterministic pick (không random)
        $index = crc32($seed) % count($phrases);
        return $phrases[$index];
    }
}
