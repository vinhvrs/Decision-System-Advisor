<?php

namespace Platform\Plugins\Advisor\Src;

use Platform\Plugins\Advisor\Src\DTO\SmoothContext;
use Platform\Plugins\Advisor\Src\DTO\SmoothResult;

// Rules – Inbound
use Platform\Plugins\Advisor\Src\Rules\NormalizeText;
use Platform\Plugins\Advisor\Src\Rules\FixTypos;
use Platform\Plugins\Advisor\Src\Rules\TokenizeText;
use Platform\Plugins\Advisor\Src\Rules\BuildSemanticDictionary;
use Platform\Plugins\Advisor\Src\Rules\SentenceTreeBuilder;
use Platform\Plugins\Advisor\Src\Rules\DetectIntent;
use Platform\Plugins\Advisor\Src\Rules\NormalizeEntities;
use Platform\Plugins\Advisor\Src\Rules\DecisionBuilder;

// Rules – Outbound
use Platform\Plugins\Advisor\Src\Rules\ComposeResponse;
use Platform\Plugins\Advisor\Src\Rules\ApplyStylePreset;
use Platform\Plugins\Advisor\Src\Rules\PostProcess;

class LanguageSmoother
{
    /** ===============================
     *  Dictionaries / Config
     *  =============================== */
    protected array $typos;
    protected array $glossary;
    protected array $intentPhrases;
    protected array $phrases;
    protected array $responseProfiles;
    protected array $stylePresets;

    public function __construct()
    {
        // 🔹 Dictionaries (NO hardcode in rules)
        $this->typos          = require __DIR__ . '/Dictionaries/typos.php';
        $this->glossary       = require __DIR__ . '/Dictionaries/glossary.php';
        $this->intentPhrases = require __DIR__ . '/Dictionaries/intent_phrases.php';
        $this->phrases       = require __DIR__ . '/Dictionaries/phrases.php';

        // 🔹 Response styles
        $this->responseProfiles = config('language_smooth.response_style', []);
        $this->stylePresets     = $this->responseProfiles['profiles'] ?? [];
    }

    /** ===============================
     *  MAIN PIPELINE
     *  =============================== */
    public function smooth(string $text, SmoothContext $ctx): SmoothResult
    {
        $original = $text;

        /* ==========================================================
         | INBOUND — USER INPUT → DECISION OBJECT
         |========================================================== */
        if ($ctx->direction === 'in') {

            // Reset memory every inbound request
            $ctx->memory = [];

            // 1️⃣ Normalize raw text
            $text = (new NormalizeText())->handle($text, $ctx);
            $this->logStep('NormalizeText', $ctx);

            // 2️⃣ Fix typos (dictionary-based)
            $text = (new FixTypos($this->typos))->handle($text, $ctx);
            $this->logStep('FixTypos', $ctx);

            // 3️⃣ Tokenize
            $text = (new TokenizeText())->handle($text, $ctx);
            $this->logStep('TokenizeText', $ctx);

            // 4️⃣ Build semantic dictionary (actions / modifiers / constraints)
            $text = (new BuildSemanticDictionary(
                intentPhrases: $this->intentPhrases
            ))->handle($text, $ctx);
            $this->logStep('BuildSemanticDictionary', $ctx);

            // 5️⃣ Sentence Branching Tree (core NLP reduction)
            $text = (new SentenceTreeBuilder())->handle($text, $ctx);
            $this->logStep('SentenceTreeBuilder', $ctx);

            // 6️⃣ Detect intent — BASED ON SENTENCE TREE
            $text = (new DetectIntent(
                intentPhrases: $this->intentPhrases
            ))->handle($text, $ctx);
            $this->logStep('DetectIntent', $ctx);

            // 7️⃣ Normalize entities (ticker / indicator / market)
            $text = (new NormalizeEntities())->handle($text, $ctx);
            $this->logStep('NormalizeEntities', $ctx);

            // 8️⃣ Build Decision Object (🎯 FINAL TARGET)
            $text = (new DecisionBuilder())->handle($text, $ctx);
            $this->logStep('DecisionBuilder', $ctx);

            return new SmoothResult(
                originalText: $original,
                cleanText: $text,
                intent: $ctx->memory['decision']['intent'] ?? null,
                entities: $ctx->memory['decision']['entities'] ?? [],
                constraints: $ctx->memory['decision']['modifiers'] ?? [],
                notes: [
                    'tokens'        => $ctx->memory['tokens'] ?? [],
                    'semantic'      => $ctx->memory['semantic'] ?? [],
                    'sentence_tree' => $ctx->memory['sentence_tree'] ?? [],
                    'decision'      => $ctx->memory['decision'] ?? [],
                ]
            );
        }

        /* ==========================================================
         | OUTBOUND — DECISION → RESPONSE
         |========================================================== */
        $preset = $this->stylePresets[$ctx->stylePreset]
            ?? ($this->stylePresets['standard'] ?? ['max_sentences' => 8]);

        // Compose logical response (NO NLP here)
        $text = (new ComposeResponse(
            phrases: $this->phrases
        ))->handle(
            $text,
            $ctx,
            $ctx->memory['decision'] ?? null
        );

        // Apply style + polish
        $text = (new ApplyStylePreset($preset))->handle($text);
        $text = (new PostProcess($this->glossary))->handle($text);

        return new SmoothResult(
            originalText: $original,
            cleanText: $text,
            intent: $ctx->memory['decision']['intent'] ?? null,
            entities: $ctx->memory['decision']['entities'] ?? [],
            constraints: ['stylePreset' => $ctx->stylePreset],
            notes: []
        );
    }

    /** ===============================
     *  DEBUG LOGGER
     *  =============================== */
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
