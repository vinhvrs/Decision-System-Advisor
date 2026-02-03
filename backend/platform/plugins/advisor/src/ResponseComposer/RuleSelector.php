<?php

namespace Platform\Plugins\Advisor\Src\ResponseComposer;

use App\DTO\DecisionResult;

class RuleSelector
{
    public static function shouldIncludeMomentum(DecisionResult $r): bool
    {
        return $r->technicalSummary['momentum'] !== 'neutral';
    }

    public static function shouldIncludeConfidence(DecisionResult $r): bool
    {
        return $r->confidenceScore >= 50;
    }
}
