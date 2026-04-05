import random
from config.dictionaries.phrases import PHRASES, ERROR_MESSAGES

class ComposeResponse:
    def __init__(self, phrases: dict = None):
        self.phrases = phrases or PHRASES

    def handle(self, text: str, ctx, intent: str = None) -> str:
        decision = ctx.memory.get('decision', {})
        strategy = decision.get('strategy', {})
        
        # 1) Data required but no ticker
        if strategy.get('require_data') and not decision.get('entities', {}).get('tickers'):
            return ERROR_MESSAGES.get('missing_entity', "Please specify a stock so I can help.")

        # 2) Phrasing disabled
        if not strategy.get('allow_llm', True):
            return text

        # 3) Build phrased reply
        prefix = self.pick_prefix(ctx, strategy)
        body = self.pick_intent_phrase(intent) or text
        follow_up = self.pick_follow_up(ctx)

        # Drop empty parts, single-space join
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
        # Follow-up only on outbound pass
        if ctx.direction != 'out':
            return None
        follow_ups = self.phrases.get('follow_up', [])
        return random.choice(follow_ups) if follow_ups else None