import re
from app.analyze.nlp.models import SmoothContext
from config.dictionaries.logic import STRATEGY
from config.dictionaries.mapping import INDICATORS

class NormalizeEntities:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        tokens = ctx.get('tokens', [])
        entities = {'tickers': [], 'indicators': []}

        # 1. Xác định Indicators (Chỉ báo kỹ thuật)
        for token in tokens:
            if token.lower() in INDICATORS:
                entities['indicators'].append(token.upper())

        # 2. Xây dựng Blacklist để không nhận diện nhầm Ticker
        blacklist = set(
            STRATEGY.get('verbs', []) + 
            STRATEGY.get('fillers', []) + 
            STRATEGY.get('negations', []) + 
            STRATEGY.get('domain_nouns', [])
        )

        # 3. Trích xuất Ticker (STRICT mode) - Tương đương NormalizeEntities.php
        for token in tokens:
            upper = token.upper()
            lower = token.lower()

            if lower in blacklist or lower in INDICATORS:
                continue

            # Heuristic: Mã chứng khoán thường từ 2-6 ký tự chữ cái
            if re.match(r'^[A-Z]{2,6}$', upper):
                entities['tickers'].append(upper)

        # Loại bỏ trùng lặp
        entities['tickers'] = list(dict.fromkeys(entities['tickers']))
        entities['indicators'] = list(dict.fromkeys(entities['indicators']))

        ctx.set('entities', entities)
        return text

class DecisionBuilder:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        intent = ctx.get('intent', 'unknown')
        entities = ctx.get('entities', {})
        strategy = STRATEGY.get(intent, STRATEGY['unknown'])
        
        # Kiểm tra yêu cầu dữ liệu (Validation) - Logic từ DecisionBuilder.php
        if strategy.get('require_data') and not entities.get('tickers'):
            ctx.set('decision', {
                'intent': intent,
                'error': 'missing_ticker',
                'strategy': strategy
            })
            return text
            
        ctx.set('decision', {
            'intent': intent,
            'entities': entities,
            'strategy': strategy
        })
        return text