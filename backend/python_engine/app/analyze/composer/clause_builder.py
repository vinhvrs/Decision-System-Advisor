import zlib

class ClauseBuilder:
    @staticmethod
    def pick(phrases: list[str], seed: str) -> str:
        """Deterministic phrase pick from seed (CRC32 like PHP)."""
        if not phrases:
            return ""
        
        # zlib.crc32 for stable index
        checksum = zlib.crc32(seed.encode('utf-8')) & 0xffffffff
        index = checksum % len(phrases)
        return phrases[index]

    @staticmethod
    def build_technical_clause(result: dict) -> str:
        # Join technical phrase list from result payload
        return " ".join(result.get('phrases', []))