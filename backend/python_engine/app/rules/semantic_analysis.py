from app.analyze.nlp.models import SmoothContext
from config.dictionaries.mapping import INTENTS, INDICATORS
from config.dictionaries.logic import STRATEGY

class BuildSemanticDictionary:
    def __init__(self):
        self.negations = set(STRATEGY.get('negations', ['no', 'not', 'without', "don't", 'ignore', 'except', 'instead']))
        self.reversals = {'don', "don't", 'not', 'never'} 

    def handle(self, text: str, ctx: SmoothContext) -> str:
        tokens = ctx.get('tokens', [])
        tokens_low = [t.lower() for t in tokens]
        
        semantic = {
            'actions': [],
            'constraints': {}, 
            'features': []
        }

        for i, token in enumerate(tokens_low):
            for intent_name, keywords in INTENTS.items():
                if token in keywords:
                    semantic['actions'].append(token)

            if token in self.negations:
                is_double_negation = False
                
                if i > 0 and tokens_low[i-1] in self.reversals and token in ['ignore', 'stop', 'skip']:
                    is_double_negation = True

                window = tokens_low[i+1 : i+4]
                for target in window:
                    semantic['constraints'][target] = is_double_negation

            if token in INDICATORS:
                semantic['features'].append(token.upper())

        ctx.set('semantic', semantic)
        return text

class DetectIntent:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        semantic = ctx.get('semantic', {})
        actions = semantic.get('actions', [])
        constraints = semantic.get('constraints', {})
        
        valid_actions = [a for a in actions if constraints.get(a.lower(), True) is not False]
        
        intent = 'unknown'
        for intent_name, keywords in INTENTS.items():
            if any(word in keywords for word in valid_actions):
                intent = intent_name
                break
        
        ctx.set('intent', intent)
        return text

class SentenceTreeBuilder:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        semantic = ctx.get('semantic', {})
        entities = ctx.get('entities', {})
        constraints = semantic.get('constraints', {})
        intent = ctx.get('intent', 'unknown')
        
        raw_tickers = entities.get('tickers', [])
        valid_targets = [t for t in raw_tickers if constraints.get(t.lower(), True) is not False]
        
        if 'instead' in text.lower() and len(raw_tickers) > 1:
            if valid_targets:
                valid_targets = [valid_targets[-1]] 

        features = entities.get('indicators', []) + entities.get('attributes', [])
        valid_features = [f for f in features if constraints.get(f.lower(), True) is not False]

        negated_list = [k.upper() for k, v in constraints.items() if v is False]

        is_valid = len(valid_targets) > 0
        if not is_valid and len(negated_list) > 0 and ('except' in text.lower() or 'ignore' in text.lower()):
            is_valid = True

        sentence_tree = {
            'action': intent,
            'targets': valid_targets,
            'features': valid_features,
            'negated': negated_list,
            'is_valid': is_valid
        }
        
        ctx.set('sentence_tree', sentence_tree)
        
        entities['tickers'] = valid_targets
        ctx.set('entities', entities)
        
        return text