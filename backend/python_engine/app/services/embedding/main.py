import httpx
import logging
import asyncio
from typing import List, Optional
from config.settings import settings

class EmbeddingService:
    def __init__(self):
        # Đảm bảo URL kết thúc đúng định dạng
        self.url = f"{settings.EMBEDDING_SERVICE_URL.rstrip('/')}/embed"
        self.logger = logging.getLogger(__name__)

    async def embed(self, text: str) -> List[float]:
        """
        Chuyển đổi văn bản thành Vector Embedding thông qua dịch vụ nội bộ.
        """
        if not text or not text.strip():
            self.logger.warning("Empty text provided for embedding.")
            return []

        payload = {"text": text.strip()}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.url, 
                    json=payload, 
                    timeout=settings.EMBEDDING_TIMEOUT if hasattr(settings, 'EMBEDDING_TIMEOUT') else 30.0
                )
                
                # Kiểm tra lỗi HTTP (4xx, 5xx)
                response.raise_for_status()
                
                vector = response.json()
                
                if not isinstance(vector, list):
                    self.logger.error(f"Unexpected response format: {vector}")
                    raise ValueError("Embedding service did not return a list.")
                
                return vector

        except httpx.HTTPStatusError as e:
            self.logger.error(f"Embedding Service HTTP Error: {e.response.status_code} - {e.response.text}")
            raise RuntimeError(f"Embedding service failed with status {e.response.status_code}")
            
        except httpx.RequestError as e:
            self.logger.error(f"Embedding Service Connection Error: {e}")
            raise RuntimeError("Could not connect to Embedding Service.")
            
        except Exception as e:
            self.logger.error(f"Unexpected error in EmbeddingService: {e}")
            raise

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Xử lý nhìu văn bản cùng lúc (nếu API hỗ trợ batch, nếu không sẽ chạy song song)
        """
        tasks = [self.embed(text) for text in texts]
        return await asyncio.gather(*tasks)

# Khởi tạo instance mặc định
embedding_service = EmbeddingService()