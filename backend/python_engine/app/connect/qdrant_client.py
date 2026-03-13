from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models
from config.settings import Config
# SỬA LỖI: Bổ sung 'Dict' vào danh sách import
from typing import Optional, List, Any, Dict 

class QdrantService:
    def __init__(self):
        # Sử dụng AsyncQdrantClient để tương thích với luồng await trong chatbot
        self.client = AsyncQdrantClient(
            url=getattr(Config, 'QDRANT_URL', "http://localhost:6333"), 
            prefer_grpc=False
        )
        self.collection = "knowledge"

    async def _ensure_collection(self):
        """Đảm bảo collection tồn tại với đúng số chiều của model e5-small-v2 (384)"""
        try:
            collections = await self.client.get_collections()
            exists = any(c.name == self.collection for c in collections.collections)
            if not exists:
                await self.client.create_collection(
                    collection_name=self.collection,
                    vectors_config=models.VectorParams(
                        size=384, # Khớp với dim của intfloat/e5-small-v2
                        distance=models.Distance.COSINE
                    )
                )
        except Exception as e:
            print(f"⚠️ Qdrant Collection Error: {e}")

    async def upsert(self, point_id: Any, vector: List[float], payload: Dict):
        """Lưu trữ vector kiến thức vào Qdrant"""
        await self._ensure_collection()
        await self.client.upsert(
            collection_name=self.collection,
            points=[
                models.PointStruct(id=point_id, vector=vector, payload=payload)
            ]
        )

    async def search(self, query_vector: List[float], limit: int = 5, query_filter: Optional[Any] = None, **kwargs):
        """SỬA LỖI: Tham số query_vector và query_filter chuẩn hóa"""
        try:
            return await self.client.search(
                collection_name=self.collection,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=limit,
                with_payload=True
            )
        except Exception as e:
            return []