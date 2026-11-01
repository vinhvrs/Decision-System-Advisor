import re
from difflib import get_close_matches
from app.analyze.nlp.models import SmoothContext
from config.dictionaries.logic import STRATEGY
from config.dictionaries.mapping import INDICATORS

class NormalizeEntities:
    def __init__(self):
        self.attribute_map = {
            'volume': ['volume', 'vol', 'liquidity', 'liquid'],
            'volatility': ['volatility', 'stable', 'variance', 'risk'],
            'change': ['change', 'increase', 'decrease', 'diff'],
            'price': ['price', 'value', 'current', 'cost']
        }
        self.hard_blacklist = {
            'the', 'what', 'for', 'how', 'is', 'are', 'of', 'and', 'with', 'but',
            'don', 't', 'dont', 'instead', 'except', 'show', 'analyze', 'give', 'me',
            'current', 'today', 'now', 'info', 'data', 'should', 'would'
        }
        # Sample famous tickers
        self.common_tickers = ['AAPL', 'TSLA', 'MSFT', 'BTC', 'ETH', 'SOL', 'BNB', 'GOOGL']

    def handle(self, text: str, ctx: SmoothContext) -> str:
        tokens = ctx.get('tokens', [])
        semantic = ctx.get('semantic', {})
        constraints = semantic.get('constraints', {})
        
        entities = {'tickers': [], 'indicators': [], 'attributes': []}

        for token in tokens:
            lower = token.lower()
            upper = token.upper()

            if constraints.get(lower) is False:
                continue

            matched_attr = False
            for attr_name, keywords in self.attribute_map.items():
                if lower in keywords or get_close_matches(lower, keywords, n=1, cutoff=0.85):
                    entities['attributes'].append(attr_name)
                    matched_attr = True
                    break
            if matched_attr: continue

            if lower in INDICATORS:
                entities['indicators'].append(upper)
                continue

            if re.match(r'^[A-Za-z]{2,6}$', token):
                if lower not in self.hard_blacklist and lower not in STRATEGY.get('verbs', []):
                    
                    if token.isupper() or upper in self.common_tickers:
                        entities['tickers'].append(upper)
                    else:
                        suggestion = get_close_matches(upper, self.common_tickers, n=1, cutoff=0.75)
                        if suggestion:
                            entities['tickers'].append(suggestion[0])
                        else:
                            entities['tickers'].append(upper)

        entities['tickers'] = list(dict.fromkeys(entities['tickers']))
        entities['indicators'] = list(dict.fromkeys(entities['indicators']))
        entities['attributes'] = list(dict.fromkeys(entities['attributes']))

        ctx.set('entities', entities)
        return text

class DecisionBuilder:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        tree = ctx.get('sentence_tree', {})
        intent = ctx.get('intent', 'unknown')
        strategy = STRATEGY.get(intent, STRATEGY['unknown'])
        
        valid_targets = [t for t in tree.get('targets', []) if t.lower() not in tree.get('negated', [])]
        
        if strategy.get('require_data') and not valid_targets:
            decision = {
                'intent': intent,
                'status': 'failed',
                'error': 'missing_ticker',
                'reason': 'No valid tickers provided after filtering negations.'
            }
        else:
            decision = {
                'intent': intent,
                'status': 'success',
                'targets': valid_targets,
                'features': tree.get('features', []),
                'strategy': strategy
            }
            
        ctx.set('decision', decision)
        return text