import random
from config.dictionaries.phrases import PHRASES, ERROR_MESSAGES

class ComposeResponse:
    def __init__(self, phrases: dict = None):
        self.phrases = phrases or PHRASES

    def handle(self, text: str, ctx, intent: str = None) -> str:
        decision = ctx.memory.get('decision', {})
        strategy = decision.get('strategy', {})
        
        # 1. Nếu cần dữ liệu nhưng thiếu thực thể (đối chiếu ComposeResponse.php dòng 27)
        if strategy.get('require_data') and not decision.get('entities', {}).get('tickers'):
            return ERROR_MESSAGES.get('missing_entity', "Please specify a stock so I can help.")

        # 2. Nếu không cho phép LLM hoặc phrasing (dòng 32 PHP)
        if not strategy.get('allow_llm', True):
            return text

        # 3. Compose phrased response (dòng 37 PHP)
        prefix = self.pick_prefix(ctx, strategy)
        body = self.pick_intent_phrase(intent) or text
        follow_up = self.pick_follow_up(ctx)

        # Lọc bỏ các phần rỗng và ghép bằng khoảng trắng
        parts = [p for p in [prefix, body, follow_up] if p]
        return " ".join(parts).strip()

    def pick_prefix(self, ctx, strategy: dict) -> str:
        mode = strategy.get('mode', ctx.style_preset or 'default')
        prefixes = self.phrases.get('prefix', {}).get(mode, self.phrases['prefix'].get('spoken_professional', []))
        return random.choice(prefixes) if prefixes else ""

    def pick_intent_phrase(self, intent: str) -> str:
        if not intent or intent == 'unknown':
            return None
        phrases = self.phrases.get(intent, [])
        return random.choice(phrases) if phrases else None

    def pick_follow_up(self, ctx) -> str:
        # Chỉ thêm follow-up nếu là phản hồi hướng ngoại (dòng 76 PHP)
        if ctx.direction != 'out':
            return None
        follow_ups = self.phrases.get('follow_up', [])
        return random.choice(follow_ups) if follow_ups else None