import re
from typing import Dict
from app.analyze.nlp.models import SmoothContext
from config.dictionaries.logic import TYPOS, STRATEGY
from config.dictionaries.glossary import GLOSSARY

class NormalizeText:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        # Chuẩn hóa khoảng trắng
        text = re.sub(r'\s+', ' ', text)
        # Loại bỏ các ký tự đặc biệt gây nhiễu nhưng giữ lại dấu phẩy và chấm để phân tích vế câu sau này
        text = re.sub(r'[^\w\s\.,\?\'!]', '', text)
        return text.strip()

class FixTypos:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        # Ưu tiên sửa các cụm từ quan trọng trước
        for wrong, correct in TYPOS.items():
            # Sử dụng \b để đảm bảo chỉ sửa khi nó là một từ độc lập
            pattern = rf'\b{re.escape(wrong)}\b'
            text = re.sub(pattern, correct, text, flags=re.IGNORECASE)
        return text

class TokenizeText:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        # FIX QUAN TRỌNG: Giữ lại dấu nháy đơn (ví dụ don't, isn't) 
        # để tránh tách thành 'don' và 't' gây bắt nhầm Ticker DON
        tokens = re.findall(r"[\w']+", text.lower())
        
        # Lưu toàn bộ tokens gốc vào context để SemanticAnalysis dùng (không lọc)
        ctx.set('tokens', tokens) 
        
        # Tạo bản clean_tokens (loại bỏ từ đệm) để hỗ trợ các rule đơn giản
        blacklist = set(STRATEGY.get('fillers', []))
        clean_tokens = [t for t in tokens if t not in blacklist]
        ctx.set('clean_tokens', clean_tokens)
        
        return text

class TextProcessor:
    """Hậu xử lý cho đầu ra (Outbound) - Tương đương PostProcess.php"""
    def __init__(self, glossary: Dict[str, str] = None):
        self.glossary = glossary or GLOSSARY

    def post_process(self, text: str) -> str:
        if not text: return ""
        
        # 1. Làm sạch khoảng trắng
        text = re.sub(r'\s+', ' ', text.strip())

        # 2. Thay thế thuật ngữ từ Glossary (Ưu tiên từ dài trước để tránh ghi đè sai)
        sorted_glossary = dict(sorted(self.glossary.items(), key=lambda x: len(x[0]), reverse=True))
        for original, replacement in sorted_glossary.items():
            pattern = rf'\b{re.escape(original)}\b'
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

        # 3. Viết hoa chữ cái đầu câu
        text = text[0].upper() + text[1:] if len(text) > 0 else text

        # 4. Đảm bảo có dấu kết thúc câu
        if text and not re.search(r'[.!?]$', text):
            text += '.'

        return text