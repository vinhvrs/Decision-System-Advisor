<?php

namespace Platform\Plugins\Advisor\Src\DTO;

class SmoothResult
{
    public function __construct(
        public string $originalText,
        public string $cleanText,
        public ?string $intent = null,
        public array $entities = [],
        public array $constraints = [],
        public array $notes = [],
    ) {}
}
