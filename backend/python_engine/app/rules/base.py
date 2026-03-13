from dataclasses import dataclass, field
from typing import Any, Dict

@dataclass
class SmoothContext:
    memory: Dict[str, Any] = field(default_factory=dict)
    direction: str = 'in'  
    style_preset: str = 'standard'
    debug: bool = False

    def set(self, key: str, value: Any) -> None:
        self.memory[key] = value
        
    def get(self, key: str, default: Any = None) -> Any:
        return self.memory.get(key, default)

    def clear_memory(self) -> None:
        self.memory = {}

    def has_error(self) -> bool:
        return 'error' in self.memory.get('decision', {})