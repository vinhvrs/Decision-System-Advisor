<?php

namespace Platform\Plugins\Advisor\Src;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;
use Platform\Plugins\Advisor\Src\DTO\SmoothResult;

// Inbound rules
use Platform\Plugins\Advisor\Src\Rules\NormalizeText;
use Platform\Plugins\Advisor\Src\Rules\FixTypos;
use Platform\Plugins\Advisor\Src\Rules\TokenizeText;
use Platform\Plugins\Advisor\Src\Rules\BuildSemanticDictionary;
use Platform\Plugins\Advisor\Src\Rules\SentenceTreeBuilder;
use Platform\Plugins\Advisor\Src\Rules\DetectIntent;
use Platform\Plugins\Advisor\Src\Rules\NormalizeEntities;
use Platform\Plugins\Advisor\Src\Rules\DecisionBuilder;

// Outbound rules
use Platform\Plugins\Advisor\Src\Rules\ComposeResponse;
use Platform\Plugins\Advisor\Src\Rules\ApplyStylePreset;
use Platform\Plugins\Advisor\Src\Rules\PostProcess;

class LanguageSmoother
{
    protected array $typos;
    protected array $glossary;
    protected array $intentPhrases;
    protected array $phrases;
    protected array $responseProfiles;
    protected array $stylePresets;

    public function __construct()
    {
        $this->typos          = require __DIR__ . '/Dictionaries/typos.php';
        $this->glossary       = require __DIR__ . '/Dictionaries/glossary.php';
        $this->intentPhrases = require __DIR__ . '/Dictionaries/intent_phrases.php';
        $this->phrases       = require __DIR__ . '/Dictionaries/phrases.php';

        $this->responseProfiles = config('language_smooth.response_style', []);
        $this->stylePresets     = $this->responseProfiles['profiles'] ?? [];
    }

    /* =========================================================
     | MAIN PIPELINE
     ========================================================= */

    public function smooth(string $text, SmoothContext $ctx): SmoothResult
    {
        $original = $text;

        /* =====================================================
         | INBOUND — USER INPUT → DECISION
         ===================================================== */
        if ($ctx->direction === 'in') {

            // reset memory per request
            $ctx->memory = [];

            $text = (new NormalizeText())->handle($text, $ctx);
            $this->logStep('NormalizeText', $ctx);

            $text = (new FixTypos($this->typos))->handle($text, $ctx);
            $this->logStep('FixTypos', $ctx);

            $text = (new TokenizeText())->handle($text, $ctx);
            $this->logStep('TokenizeText', $ctx);

            $text = (new BuildSemanticDictionary(
                intentPhrases: $this->intentPhrases
            ))->handle($text, $ctx);
            $this->logStep('BuildSemanticDictionary', $ctx);

            $text = (new SentenceTreeBuilder())->handle($text, $ctx);
            $this->logStep('SentenceTreeBuilder', $ctx);

            $text = (new DetectIntent(
                intentPhrases: $this->intentPhrases
            ))->handle($text, $ctx);
            $this->logStep('DetectIntent', $ctx);

            $text = (new NormalizeEntities())->handle($text, $ctx);
            $this->logStep('NormalizeEntities', $ctx);

            $text = (new DecisionBuilder())->handle($text, $ctx);
            $this->logStep('DecisionBuilder', $ctx);

            /**
             * ✅ FIX QUAN TRỌNG
             * - constraints PHẢI lấy từ decision['constraints']
             * - KHÔNG lấy từ modifiers
             */
            return new SmoothResult(
                originalText: $original,
                cleanText: $text,
                intent: $ctx->memory['decision']['intent'] ?? null,
                entities: $ctx->memory['decision']['entities'] ?? [],
                constraints: $ctx->memory['decision']['constraints'] ?? [],
                notes: [
                    // research / debug only
                    'tokens'        => $ctx->memory['tokens'] ?? [],
                    'semantic'      => $ctx->memory['semantic'] ?? [],
                    'sentence_tree' => $ctx->memory['sentence_tree'] ?? [],
                    'decision'      => $ctx->memory['decision'] ?? [],
                ]
            );
        }

        /* =====================================================
         | OUTBOUND — DECISION → RESPONSE TEXT
         ===================================================== */

        $preset = $this->stylePresets[$ctx->stylePreset]
            ?? ($this->stylePresets['standard'] ?? ['max_sentences' => 8]);

        $text = (new ComposeResponse(
            phrases: $this->phrases
        ))->handle(
            $text,
            $ctx,
            $ctx->memory['decision'] ?? null
        );

        $text = (new ApplyStylePreset($preset))->handle($text);
        $text = (new PostProcess($this->glossary))->handle($text);

        return new SmoothResult(
            originalText: $original,
            cleanText: $text,
            intent: $ctx->memory['decision']['intent'] ?? null,
            entities: $ctx->memory['decision']['entities'] ?? [],
            constraints: [
                'stylePreset' => $ctx->stylePreset,
            ],
            notes: []
        );
    }

    /* =========================================================
     | DEBUG LOGGER (READ-ONLY)
     ========================================================= */

    private function logStep(string $step, SmoothContext $ctx): void
    {
        if (!$ctx->debug) {
            return;
        }

        logger()->info("[SMOOTH][$step]", [
            'tokens'        => $ctx->memory['tokens'] ?? null,
            'semantic'      => $ctx->memory['semantic'] ?? null,
            'sentence_tree' => $ctx->memory['sentence_tree'] ?? null,
            'intent'        => $ctx->memory['intent'] ?? null,
            'entities'      => $ctx->memory['entities'] ?? null,
            'decision'      => $ctx->memory['decision'] ?? null,
        ]);
    }
}
