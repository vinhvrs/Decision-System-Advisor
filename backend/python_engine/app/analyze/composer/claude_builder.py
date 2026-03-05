import zlib

class ClauseBuilder:
    @staticmethod
    def pick(phrases: list[str], seed: str) -> str:
        """
        Chọn một câu từ danh sách dựa trên seed (thường là mã cổ phiếu hoặc intent)
        Đảm bảo cùng một seed sẽ ra cùng một câu (giống PHP crc32)
        """
        if not phrases:
            return ""
        
        # Tính toán checksum tương tự crc32 của PHP
        checksum = zlib.crc32(seed.encode('utf-8')) & 0xffffffff
        index = checksum % len(phrases)
        return phrases[index]

    @staticmethod
    def build_technical_clause(result: dict) -> str:
        # Logic bổ sung để ghép các câu kỹ thuật từ PhraseRepository
        return " ".join(result.get('phrases', []))