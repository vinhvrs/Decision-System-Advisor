<?php

namespace Platform\Plugins\Advisor\Src;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;
use Platform\Plugins\Advisor\Src\DTO\SmoothResult;
use Platform\Plugins\Advisor\Src\Rules\NormalizeText;
use Platform\Plugins\Advisor\Src\Rules\FixTypos;
use Platform\Plugins\Advisor\Src\Rules\NormalizeEntities;
use Platform\Plugins\Advisor\Src\Rules\DetectIntent;
use Platform\Plugins\Advisor\Src\Rules\ApplyStylePreset;
use Platform\Plugins\Advisor\Src\Rules\PostProcess;
use Platform\Plugins\Advisor\Src\Rules\ComposeResponse;



class LanguageSmoother
{
    private array $typos;
    private array $glossary;
    private array $intentPhrases;
    private array $stylePresets;
    private array $phrases;
    private array $responseProfiles;

    public function __construct()
    {
        $this->typos = require __DIR__ . '\\Dictionaries\\typos.php';
        $this->glossary = require __DIR__ . '\\Dictionaries\\glossary.php';
        $this->intentPhrases = require __DIR__ . '\\Dictionaries\\intent_phrases.php';
        $this->phrases = require __DIR__ . '\\Dictionaries\\phrases.php';
        $this->responseProfiles = config('language_smooth.response_style', []);
        $this->responseStyle = config('language_smooth.response_style', [
            'default_profile' => 'spoken_professional',
            'profiles' => [
                'spoken_professional' => [
                    'use_contractions' => true,
                    'max_sentences' => 10,
                    'structure' => 'standard',
                ],
            ],
        ]);
    }

    public function smooth(string $text, SmoothContext $ctx): SmoothResult
    {
        $original = $text;
        $entities = [];
        $constraints = [];


        if ($ctx->direction === 'in') {
            $text = (new NormalizeText())->handle($text);
            $text = (new FixTypos($this->typos))->handle($text);

            $text = (new NormalizeEntities())->handle($text, $entities);

            $intent = (new DetectIntent($this->intentPhrases))->handle($text, $entities);

            // Example constraint: enforce English output if detected
            $constraints['locale'] = $ctx->locale;

            return new SmoothResult(
                originalText: $original,
                cleanText: $text,
                intent: $intent,
                entities: $entities,
                constraints: $constraints,
                notes: []
            );
        }

        // outbound
        $preset = $this->stylePresets[$ctx->stylePreset]
            ?? ($this->stylePresets['standard'] ?? ['max_sentences' => 10]);
        $composer = new ComposeResponse($this->phrases, $this->responseProfiles);
        $text = $composer->handle($text, $ctx, $ctx->memory['intent'] ?? null);
        $text = (new ApplyStylePreset($preset))->handle($text);
        $text = (new PostProcess($this->glossary))->handle($text);

        return new SmoothResult(
            originalText: $original,
            cleanText: $text,
            intent: null,
            entities: [],
            constraints: ['stylePreset' => $ctx->stylePreset],
            notes: []
        );
    }
}
