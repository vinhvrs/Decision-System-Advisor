import re
from difflib import get_close_matches
from app.analyze.nlp.models import SmoothContext
from config.dictionaries.logic import STRATEGY
from config.dictionaries.mapping import INDICATORS

class NormalizeEntities:
    def __init__(self):
        # Tầng 3: Attributes mapping
        self.attribute_map = {
            'volume': ['volume', 'vol', 'liquidity', 'liquid'],
            'volatility': ['volatility', 'stable', 'variance', 'risk'],
            'change': ['change', 'increase', 'decrease', 'diff'],
            'price': ['price', 'value', 'current', 'cost']
        }
        # Tầng 4: Blacklist mở rộng (Chặn tuyệt đối các từ gây nhiễu trong report)
        self.hard_blacklist = {
            'the', 'what', 'for', 'how', 'is', 'are', 'of', 'and', 'with', 'but',
            'don', 't', 'dont', 'instead', 'except', 'show', 'analyze', 'give', 'me',
            'current', 'today', 'now', 'info', 'data'
        }
        # Giả định danh sách các Ticker phổ biến để sửa lỗi chính tả (Nên lấy từ DB/Redis)
        self.common_tickers = ['AAPL', 'TSLA', 'MSFT', 'BTC', 'ETH', 'SOL', 'BNB', 'GOOGL']

    def handle(self, text: str, ctx: SmoothContext) -> str:
        tokens = ctx.get('tokens', [])
        semantic = ctx.get('semantic', {})
        constraints = semantic.get('constraints', {})
        
        entities = {'tickers': [], 'indicators': [], 'attributes': []}

        for token in tokens:
            lower = token.lower()
            upper = token.upper()

            # --- TẦNG 1: LỌC PHỦ ĐỊNH (Constraint Check) ---
            # Nếu bị đánh dấu False (negated) -> Bỏ qua ngay lập tức
            if constraints.get(lower) is False:
                continue

            # --- TẦNG 2: THUỘC TÍNH (Fuzzy Match cho Attributes) ---
            matched_attr = False
            for attr_name, keywords in self.attribute_map.items():
                if lower in keywords or get_close_matches(lower, keywords, n=1, cutoff=0.85):
                    entities['attributes'].append(attr_name)
                    matched_attr = True
                    break
            if matched_attr: continue

            # --- TẦNG 3: INDICATORS (RSI, MACD...) ---
            if lower in INDICATORS:
                entities['indicators'].append(upper)
                continue

            # --- TẦNG 4: TICKERS & TICKER CORRECTION ---
            # Chỉ xử lý nếu token có độ dài 2-6 ký tự và là chữ cái
            if re.match(r'^[A-Za-z]{2,6}$', token):
                if lower not in self.hard_blacklist and lower not in STRATEGY.get('verbs', []):
                    
                    # 4.1. Nếu là Ticker chuẩn (Viết hoa hoặc khớp chính xác)
                    if token.isupper() or upper in self.common_tickers:
                        entities['tickers'].append(upper)
                    else:
                        # 4.2. Xử lý sai chính tả Ticker (ví dụ: "aapp" -> "AAPL")
                        # Chỉ sửa lỗi nếu từ đó không phải là một từ tiếng Anh thông thường
                        suggestion = get_close_matches(upper, self.common_tickers, n=1, cutoff=0.75)
                        if suggestion:
                            entities['tickers'].append(suggestion[0])
                        else:
                            # Fallback: Nếu không có gợi ý nhưng thỏa mãn Regex, vẫn lấy (để bot check Redis)
                            entities['tickers'].append(upper)

        # Cleanup: Duy nhất và giữ thứ tự
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
        
        # 1. Khử mâu thuẫn: Nếu ticker nằm trong danh sách negated, loại bỏ khỏi targets
        valid_targets = [t for t in tree.get('targets', []) if t.lower() not in tree.get('negated', [])]
        
        # 2. Kiểm tra điều kiện tiên quyết của Strategy
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