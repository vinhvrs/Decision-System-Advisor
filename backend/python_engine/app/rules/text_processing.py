import re
from typing import Dict
from app.analyze.nlp.models import SmoothContext
from config.dictionaries.logic import TYPOS, STRATEGY
from config.dictionaries.glossary import GLOSSARY

class NormalizeText:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'[^\w\s\.,\?\'!]', '', text)
        return text.strip()

class FixTypos:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        for wrong, correct in TYPOS.items():
            pattern = rf'\b{re.escape(wrong)}\b'
            text = re.sub(pattern, correct, text, flags=re.IGNORECASE)
        return text

class TokenizeText:
    def handle(self, text: str, ctx: SmoothContext) -> str:
        tokens = re.findall(r"[\w']+", text.lower())
        
        ctx.set('tokens', tokens) 
        
        blacklist = set(STRATEGY.get('fillers', []))
        clean_tokens = [t for t in tokens if t not in blacklist]
        ctx.set('clean_tokens', clean_tokens)
        
        return text

class TextProcessor:
    def __init__(self, glossary: Dict[str, str] = None):
        self.glossary = glossary or GLOSSARY

    def post_process(self, text: str) -> str:
        if not text: return ""
        
        text = re.sub(r'\s+', ' ', text.strip())

        sorted_glossary = dict(sorted(self.glossary.items(), key=lambda x: len(x[0]), reverse=True))
        for original, replacement in sorted_glossary.items():
            pattern = rf'\b{re.escape(original)}\b'
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

        text = text[0].upper() + text[1:] if len(text) > 0 else text

        if text and not re.search(r'[.!?]$', text):
            text += '.'

        return text