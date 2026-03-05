from config.dictionaries.logic import STRATEGY

class StrategyResolverService:
    def __init__(self):
        self.strategy_dict = STRATEGY

    def resolve(self, intent: str) -> dict:
        """Lấy cấu hình xử lý cho Intent (giống strategy.php)"""
        return self.strategy_dict.get(intent, self.strategy_dict['unknown'])

    def get_blacklist_keywords(self) -> list:
        """Hợp nhất các danh sách từ cấm để lọc Ticker (đối chiếu PHP)"""
        return (
            self.strategy_dict.get('verbs', []) +
            self.strategy_dict.get('fillers', []) +
            self.strategy_dict.get('negations', []) +
            self.strategy_dict.get('domain_nouns', []) +
            self.strategy_dict.get('stopwords', [])
        )

    def is_llm_allowed(self, intent: str) -> bool:
        """Kiểm tra xem Intent có được phép dùng AI để diễn đạt lại không"""
        strat = self.resolve(intent)
        return strat.get('allow_llm', True)

    def get_mode(self, intent: str) -> str:
        """Lấy mode (informative, advisory, v.v.)"""
        return self.resolve(intent).get('mode', 'fallback')