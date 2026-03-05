import re
from app.analyze.nlp.models import SmoothContext

class ApplyStylePreset:
    def __init__(self, preset: dict = None):
        self.preset = preset or {}

    def handle(self, text: str, ctx: SmoothContext) -> str:
        # Cắt số lượng câu dựa trên preset (Tương đương ApplyStylePreset.php)
        max_sentences = self.preset.get('max_sentences')
        
        if max_sentences:
            # Regex phân tách câu dựa trên . ! ?
            sentences = re.split(r'(?<=[.!?])\s+', text.strip())
            text = ' '.join(sentences[:max_sentences])
            
        return text.strip()