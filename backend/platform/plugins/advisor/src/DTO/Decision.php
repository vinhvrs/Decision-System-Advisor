<?php

namespace Platform\Plugins\Advisor\Src\DTO;

class Decision
{
    public function __construct(
        public string $intent,
        public array $entity = [],
        public array $modifiers = [],
        public float $confidence = 1.0
    ) {}

    public static function empty(): self
    {
        return new self(
            intent: 'unknown',
            entity: [],
            modifiers: [],
            confidence: 0.0
        );
    }

    public function toArray(): array
    {
        return [
            'intent'     => $this->intent,
            'entity'     => $this->entity,
            'modifiers'  => $this->modifiers,
            'confidence' => $this->confidence,
        ];
    }
}
