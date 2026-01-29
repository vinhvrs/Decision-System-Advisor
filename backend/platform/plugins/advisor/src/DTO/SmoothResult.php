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
        public array $notes = []
    ) {}

    /**
     * Convert to array (useful for API / debug)
     */
    public function toArray(): array
    {
        return [
            'original_text' => $this->originalText,
            'clean_text'    => $this->cleanText,
            'intent'        => $this->intent,
            'entities'      => $this->entities,
            'constraints'   => $this->constraints,
            'notes'         => $this->notes,
        ];
    }
}
