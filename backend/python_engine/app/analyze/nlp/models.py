from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

@dataclass
class SmoothContext:
    direction: str = 'in'  # 'in' = user input, 'out' = system response
    style_preset: str = "standard"
    debug: bool = False
    memory: Dict[str, Any] = field(default_factory=dict)
    # NLP pipeline errors collected during smoothing
    errors: List[str] = field(default_factory=list)

    def set(self, key: str, value: Any):
        self.memory[key] = value
        
    def get(self, key: str, default: Any = None):
        return self.memory.get(key, default)

    def has_error(self) -> bool:
        return len(self.errors) > 0

    def add_error(self, message: str):
        self.errors.append(message)

@dataclass
class SmoothResult:
    original_text: str
    clean_text: str
    intent: Optional[str] = None
    entities: Dict[str, List[str]] = field(default_factory=dict)
    decision: Dict[str, Any] = field(default_factory=dict)
    output_text: str = ""
    notes: Dict[str, Any] = field(default_factory=dict)