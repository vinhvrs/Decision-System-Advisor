class RuleSelector:
    @staticmethod
    def should_include_momentum(result: dict) -> bool:
        # Mirror PHP: skip flat momentum in copy
        summary = result.get('technical_summary', {})
        return summary.get('momentum') not in ['neutral', None]

    @staticmethod
    def should_include_confidence(result: dict) -> bool:
        return result.get('confidence_score', 0) >= 40

    @staticmethod
    def detect_intent(semantic_actions: list, intent_phrases: dict) -> str:
        """Map semantic action tokens to first matching intent bucket."""
        if not semantic_actions:
            return 'unknown'
            
        actions_set = set(semantic_actions)
        for intent_name, keywords in intent_phrases.items():
            # PHP array_intersect ~ set intersection
            if actions_set.intersection(set(keywords)):
                return intent_name
                
        return 'unknown'

    @staticmethod
    def filter_by_style(phrases: list, style_preset: dict) -> list:
        # Optional max_sentences from style preset
        max_s = style_preset.get('max_sentences')
        return phrases[:max_s] if max_s else phrases