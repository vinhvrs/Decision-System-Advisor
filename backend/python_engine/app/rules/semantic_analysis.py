from app.analyze.nlp.models import SmoothContext
from config.dictionaries.mapping import INTENTS, INDICATORS
from config.dictionaries.logic import STRATEGY

class BuildSemanticDictionary:
    def __init__(self):
        self.negations = STRATEGY.get('negations', ['no', 'not', 'without'])

    def handle(self, text: str, ctx: SmoothContext) -> str:
        tokens = ctx.get('tokens', [])
        semantic = {
            'actions': [],
            'constraints': {},
            'features': []
        }

        for i, token in enumerate(tokens):
            # Khớp Actions (Intent Keywords)
            for intent, keywords in INTENTS.items():
                if token in keywords:
                    semantic['actions'].append(token)

            # Khớp Negations (Phủ định) - Logic từ BuildSemanticDictionary.php
            if token in self.negations and i + 1 < len(tokens):
                next_token = tokens[i + 1]
                semantic['constraints'][next_token] = False

            # Khớp Features (Chỉ báo)
            if token in INDICATORS:
                semantic['features'].append(token.upper())

        ctx.set('semantic', semantic)
        return text

class DetectIntent:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        semantic = ctx.get('semantic', {})
        actions = semantic.get('actions', [])
        
        intent = 'unknown'
        for intent_name, keywords in INTENTS.items():
            # Nếu có bất kỳ keyword nào của intent xuất hiện trong actions
            if any(word in keywords for word in actions):
                intent = intent_name
                break
        
        ctx.set('intent', intent)
        return text