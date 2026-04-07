import logging
from .models import SmoothContext, SmoothResult
from app.rules.text_processing import NormalizeText, FixTypos, TokenizeText, TextProcessor
from app.rules.semantic_analysis import BuildSemanticDictionary, DetectIntent, SentenceTreeBuilder
from app.rules.entity_management import NormalizeEntities, DecisionBuilder
from app.analyze.composer.engine import ComposeResponse

class LanguageSmoother:
    def __init__(self):
        # NLP pipeline stages
        self.normalizer = NormalizeText()
        self.typo_fixer = FixTypos()
        self.tokenizer = TokenizeText()
        self.semantic_builder = BuildSemanticDictionary()
        self.intent_detector = DetectIntent()
        self.tree_builder = SentenceTreeBuilder()
        self.entity_normalizer = NormalizeEntities()
        self.decision_builder = DecisionBuilder()
        self.composer = ComposeResponse()
        self.post_processor = TextProcessor()

    def smooth(self, text: str, ctx: SmoothContext) -> SmoothResult:
        original = text
        current_text = text

        # --- Inbound (user text) ---
        if ctx.direction == 'in':
            ctx.memory = {} 
            
            # 1) Normalize text
            current_text = self.normalizer.handle(current_text, ctx)
            current_text = self.typo_fixer.handle(current_text, ctx)
            
            # 2) Semantics and entities
            current_text = self.tokenizer.handle(current_text, ctx)
            current_text = self.semantic_builder.handle(current_text, ctx)
            current_text = self.entity_normalizer.handle(current_text, ctx)

            # 3) Intent + sentence tree (action, target, constraints)
            current_text = self.intent_detector.handle(current_text, ctx)
            current_text = self.tree_builder.handle(current_text, ctx) 
            
            # 4) Final decision frame
            current_text = self.decision_builder.handle(current_text, ctx) 
            
            return SmoothResult(
                original_text=original,
                clean_text=current_text,
                intent=ctx.get('intent'),
                entities=ctx.get('entities'),
                decision=ctx.get('decision'),
                notes={'tree': ctx.get('sentence_tree')}
            )

        # --- Outbound (response text) ---
        else:
            # 1) Compose prefix, body, follow-up
            intent = ctx.get('intent', 'unknown')
            composed_text = self.composer.handle(current_text, ctx, intent)
            
            # 2) Glossary / punctuation cleanup
            final_text = self.post_processor.post_process(composed_text)
            
            return SmoothResult(
                original_text=original,
                clean_text=current_text,
                output_text=final_text
            )