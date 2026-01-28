<?php

namespace Platform\Plugins\Advisor\Src\DTO;

class SmoothContext
{
    /**
     * @param string $direction   in | out
     * @param string $stylePreset standard | concise | ...
     * @param string $locale      en | vi | ...
     * @param array  $memory      shared memory between rules
     * @param bool   $debug       enable step-by-step logging
     */
    public function __construct(
        public string $direction = 'in',
        public string $stylePreset = 'standard',
        public string $locale = 'en',
        public array $memory = [],
        public bool $debug = false
    ) {}

    /**
     * Helper: store value into memory
     */
    public function set(string $key, mixed $value): void
    {
        $this->memory[$key] = $value;
    }

    /**
     * Helper: read value from memory
     */
    public function get(string $key, mixed $default = null): mixed
    {
        return $this->memory[$key] ?? $default;
    }
}
