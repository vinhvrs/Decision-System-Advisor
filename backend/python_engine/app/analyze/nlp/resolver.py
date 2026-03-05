import logging
from .models import SmoothContext, SmoothResult
# Import các rules từ app/rules
from app.rules.text_processing import NormalizeText, FixTypos, TokenizeText, TextProcessor
from app.rules.semantic_analysis import BuildSemanticDictionary, DetectIntent
from app.rules.entity_management import NormalizeEntities, DecisionBuilder
from app.analyze.composer.engine import ComposeResponse

class LanguageSmoother:
    def __init__(self):
        # Khởi tạo các thành phần pipeline
        self.normalizer = NormalizeText()
        self.typo_fixer = FixTypos()
        self.tokenizer = TokenizeText()
        self.semantic_builder = BuildSemanticDictionary()
        self.intent_detector = DetectIntent()
        self.entity_normalizer = NormalizeEntities()
        self.decision_builder = DecisionBuilder()
        self.composer = ComposeResponse()
        self.post_processor = TextProcessor()

    def smooth(self, text: str, ctx: SmoothContext) -> SmoothResult:
        original = text
        current_text = text

        # =====================================================
        # INBOUND — Phân tích đầu vào (giống PHP flow)
        # =====================================================
        if ctx.direction == 'in':
            ctx.memory = {} # Reset memory cho request mới
            
            # 1. Tiền xử lý văn bản
            current_text = self.normalizer.handle(current_text, ctx)
            current_text = self.typo_fixer.handle(current_text, ctx)
            
            # 2. Phân tích ngữ nghĩa & Intent
            current_text = self.tokenizer.handle(current_text, ctx)
            current_text = self.semantic_builder.handle(current_text, ctx)
            current_text = self.intent_detector.handle(current_text, ctx)
            
            # 3. Trích xuất thực thể & Đưa ra quyết định (Strategy)
            current_text = self.entity_normalizer.handle(current_text, ctx)
            current_text = self.decision_builder.handle(current_text, ctx)

            return SmoothResult(
                original_text=original,
                clean_text=current_text,
                intent=ctx.get('intent'),
                entities=ctx.get('entities'),
                decision=ctx.get('decision')
            )

        # =====================================================
        # OUTBOUND — Tạo phản hồi (giống PHP flow)
        # =====================================================
        else:
            # 1. Compose: Ghép prefix, body và follow-up
            intent = ctx.get('intent', 'unknown')
            composed_text = self.composer.handle(current_text, ctx, intent)
            
            # 2. Hậu xử lý (Glossary, Punctuation)
            final_text = self.post_processor.post_process(composed_text)
            
            return SmoothResult(
                original_text=original,
                clean_text=current_text,
                output_text=final_text
            )