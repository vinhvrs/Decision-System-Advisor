from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models
from config.settings import Config
from typing import Optional, List, Any, Dict

class QdrantService:
    def __init__(self):
        # Async client for await-based chatbot flow
        self.client = AsyncQdrantClient(
            url=getattr(Config, 'QDRANT_URL', "http://localhost:6333"), 
            prefer_grpc=False
        )
        self.collection = "knowledge"

    async def _ensure_collection(self):
        """Ensure collection exists with vector size 384 (intfloat/e5-small-v2)."""
        try:
            collections = await self.client.get_collections()
            exists = any(c.name == self.collection for c in collections.collections)
            if not exists:
                await self.client.create_collection(
                    collection_name=self.collection,
                    vectors_config=models.VectorParams(
                        size=384,  # intfloat/e5-small-v2
                        distance=models.Distance.COSINE
                    )
                )
        except Exception as e:
            print(f"[qdrant] Collection error: {e}")

    async def upsert(self, point_id: Any, vector: List[float], payload: Dict):
        """Upsert a knowledge vector into Qdrant."""
        await self._ensure_collection()
        await self.client.upsert(
            collection_name=self.collection,
            points=[
                models.PointStruct(id=point_id, vector=vector, payload=payload)
            ]
        )

    async def search(self, query_vector: List[float], limit: int = 5, query_filter: Optional[Any] = None, **kwargs):
        """Vector search with optional Qdrant filter."""
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