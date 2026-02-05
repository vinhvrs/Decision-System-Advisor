<?php

namespace Platform\Plugins\Advisor\Src\ResponseComposer;

use App\DTO\DecisionResult;

class ResponseComposer
{
    // public function compose(DecisionResult $result): string
    // {
    //     $sentences = [];
    //     $seed = $result->symbol . $result->recommendation;

    //     // Intro
    //     $sentences[] = ClauseBuilder::pick(
    //         PhraseRepository::intro($result->recommendation),
    //         $seed . 'intro'
    //     );

    //     // Trend
    //     $sentences[] = ClauseBuilder::pick(
    //         PhraseRepository::trend($result->technicalSummary['trend']),
    //         $seed . 'trend'
    //     );

    //     // Momentum (optional)
    //     if (RuleSelector::shouldIncludeMomentum($result)) {
    //         $sentences[] = ClauseBuilder::pick(
    //             PhraseRepository::momentum($result->technicalSummary['momentum']),
    //             $seed . 'momentum'
    //         );
    //     }

    //     // Confidence (optional)
    //     if (RuleSelector::shouldIncludeConfidence($result)) {
    //         $sentences[] = ClauseBuilder::pick(
    //             PhraseRepository::confidence($result->confidenceScore),
    //             $seed . 'confidence'
    //         );
    //     }

    //     // Final decision (always last)
    //     $sentences[] = PhraseRepository::decision($result->recommendation)[0];

    //     return implode(' ', $sentences);
    // }
}
