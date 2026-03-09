import httpx
import logging
import asyncio
from typing import List
from config.settings import Config

class EmbeddingService:
    def __init__(self):
        # Đảm bảo dùng 127.0.0.1 để tránh lỗi getaddrinfo
        base_url = "http://127.0.0.1:8000" 
        self.url = f"{base_url}/embed"
        self.logger = logging.getLogger(__name__)
        self.client = httpx.AsyncClient(timeout=30.0)

    async def embed(self, text: str) -> List[float]:
        if not text or not text.strip():
            return []
        try:
            response = await self.client.post(self.url, json={"text": text.strip()})
            response.raise_for_status()
            data = response.json()
            
            # Fix: Bóc tách vector từ dictionary trả về
            if isinstance(data, dict) and 'vector' in data:
                return data['vector']
            return data if isinstance(data, list) else [0.0] * 384
        except Exception as e:
            self.logger.error(f"Embedding Error: {e}")
            return [0.0] * 384

embedding_service = EmbeddingService()