import re
from app.analyze.nlp.models import SmoothContext

class ApplyStylePreset:
    def __init__(self, preset: dict = None):
        self.preset = preset or {}

    def handle(self, text: str, ctx: SmoothContext) -> str:
        max_sentences = self.preset.get('max_sentences')
        
        if max_sentences:
            sentences = re.split(r'(?<=[.!?])\s+', text.strip())
            text = ' '.join(sentences[:max_sentences])
            
        return text.strip()