from config.dictionaries.logic import STRATEGY

class StrategyResolverService:
    def __init__(self):
        self.strategy_dict = STRATEGY

    def resolve(self, intent: str) -> dict:
        """Return strategy config for intent (see STRATEGY dict)."""
        return self.strategy_dict.get(intent, self.strategy_dict['unknown'])

    def get_blacklist_keywords(self) -> list:
        """Merged stop/verb/filler lists for ticker filtering."""
        return (
            self.strategy_dict.get('verbs', []) +
            self.strategy_dict.get('fillers', []) +
            self.strategy_dict.get('negations', []) +
            self.strategy_dict.get('domain_nouns', []) +
            self.strategy_dict.get('stopwords', [])
        )

    def is_llm_allowed(self, intent: str) -> bool:
        """Whether this intent allows LLM-style phrasing."""
        strat = self.resolve(intent)
        return strat.get('allow_llm', True)

    def get_mode(self, intent: str) -> str:
        """Response mode (informative, advisory, etc.)."""
        return self.resolve(intent).get('mode', 'fallback')