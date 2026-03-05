import re
from typing import Dict
from app.analyze.nlp.models import SmoothContext
from config.dictionaries.logic import TYPOS, STRATEGY
from config.dictionaries.glossary import GLOSSARY

class NormalizeText:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        # Normalize whitespace (tương đương preg_replace('/\\s+/', ' ', $text))
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

class FixTypos:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        # Sửa lỗi chính tả dựa trên từ điển TYPOS
        for wrong, correct in TYPOS.items():
            pattern = rf'\b{re.escape(wrong)}\b'
            text = re.sub(pattern, correct, text, flags=re.IGNORECASE)
        return text

class TokenizeText:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        # Tách từ và lọc bỏ stopword/filler (Logic từ PHP)
        tokens = re.findall(r'\w+', text.lower())
        
        # Lấy danh sách từ cần loại bỏ để clean tokens
        blacklist = set(STRATEGY.get('verbs', []) + STRATEGY.get('fillers', []))
        clean_tokens = [t for t in tokens if t not in blacklist]
        
        ctx.set('tokens', clean_tokens)
        return text

class TextProcessor:
    """Hậu xử lý cho đầu ra (Outbound) - Tương đương PostProcess.php"""
    def __init__(self, glossary: Dict[str, str] = None):
        self.glossary = glossary or GLOSSARY

    def post_process(self, text: str) -> str:
        if not text: return ""
        
        # 1. Làm sạch khoảng trắng
        text = re.sub(r'\s+', ' ', text.strip())

        # 2. Thay thế thuật ngữ từ Glossary
        for original, replacement in self.glossary.items():
            pattern = rf'\b{re.escape(original)}\b'
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

        # 3. Đảm bảo có dấu kết thúc câu (Logic từ PostProcess.php)
        if text and not re.search(r'[.!?]$', text):
            text += '.'

        return text