from app.analyze.nlp.models import SmoothContext
from config.dictionaries.mapping import INTENTS, INDICATORS
from config.dictionaries.logic import STRATEGY

class BuildSemanticDictionary:
    def __init__(self):
        # Thêm 'except' và 'instead' vào danh sách kích hoạt windowing
        self.negations = set(STRATEGY.get('negations', ['no', 'not', 'without', "don't", 'ignore', 'except', 'instead']))
        # Bổ sung biến thể "don't" vào reversals để xử lý double negation
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
            # 1. Khớp Actions
            for intent_name, keywords in INTENTS.items():
                if token in keywords:
                    semantic['actions'].append(token)

            # 2. Xử lý Phủ định (Negative Windowing)
            if token in self.negations:
                is_double_negation = False
                
                # FIX LOGIC: Kiểm tra từ đứng trước để xác định phủ định kép
                # Ví dụ: "don't" (i-1) + "ignore" (i)
                if i > 0 and tokens_low[i-1] in self.reversals and token in ['ignore', 'stop', 'skip']:
                    is_double_negation = True

                # Quét cửa sổ 3 từ tiếp theo
                window = tokens_low[i+1 : i+4]
                for target in window:
                    # Nếu là double negation -> True (giữ), nếu là phủ định đơn -> False (loại)
                    semantic['constraints'][target] = is_double_negation

            # 3. Khớp Indicators
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
        
        # 1. Lọc Targets (Tickers)
        raw_tickers = entities.get('tickers', [])
        valid_targets = [t for t in raw_tickers if constraints.get(t.lower(), True) is not False]
        
        # 2. Xử lý đặc biệt cho logic "instead"
        if 'instead' in text.lower() and len(raw_tickers) > 1:
            if valid_targets:
                valid_targets = [valid_targets[-1]] 

        # 3. Gom nhóm Features
        features = entities.get('indicators', []) + entities.get('attributes', [])
        valid_features = [f for f in features if constraints.get(f.lower(), True) is not False]

        # 4. Xác định danh sách bị loại trừ (Negated)
        negated_list = [k.upper() for k, v in constraints.items() if v is False]

        # 5. Dựng Canonical Frame
        # FIX: Nếu là case "Except", dù valid_targets rỗng vẫn coi là hợp lệ để chuyển qua DecisionBuilder xử lý 'ALL_EXCEPT'
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
        
        # Cập nhật lại entities để các tầng sau (như DecisionBuilder) nhận dữ liệu sạch
        entities['tickers'] = valid_targets
        ctx.set('entities', entities)
        
        return text