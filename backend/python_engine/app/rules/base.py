from dataclasses import dataclass, field
from typing import Any, Dict

@dataclass
class SmoothContext:
    """
    Data Transfer Object để lưu trữ trạng thái của luồng phân tích.
    Tương đương với SmoothContext.php trong hệ thống cũ.
    """
    memory: Dict[str, Any] = field(default_factory=dict)
    direction: str = 'in'  # 'in' (Inbound - User input) hoặc 'out' (Outbound - Bot response)
    style_preset: str = 'standard'
    debug: bool = False

    def set(self, key: str, value: Any) -> None:
        """Lưu thông tin vào bộ nhớ tạm của context"""
        self.memory[key] = value
        
    def get(self, key: str, default: Any = None) -> Any:
        """Lấy thông tin từ bộ nhớ tạm"""
        return self.memory.get(key, default)

    def clear_memory(self) -> None:
        """Reset bộ nhớ khi bắt đầu một luồng xử lý mới"""
        self.memory = {}

    def has_error(self) -> bool:
        """Kiểm tra xem quá trình phân tích (DecisionBuilder) có phát hiện lỗi không"""
        return 'error' in self.memory.get('decision', {})