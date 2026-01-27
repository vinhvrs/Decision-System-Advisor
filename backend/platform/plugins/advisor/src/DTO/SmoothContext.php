<?php

namespace Platform\Plugins\Advisor\Src\DTO;

class SmoothContext
{
    public function __construct(
        public string $direction = 'in',
        public string $stylePreset = 'standard',
        public string $locale = 'en',
        public array $memory = [],
    ) {}
}
