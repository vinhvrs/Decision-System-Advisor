# app/connect/qdrant_client.py
from qdrant_client import QdrantClient
from qdrant_client.http import models
from config.settings import Config  # Đảm bảo dùng đúng class Config của bạn

class QdrantService:
    def __init__(self):
        # QUAN TRỌNG: prefer_grpc=False để tránh lỗi Python 3.13
        # url lấy từ config, ví dụ: "http://localhost:6333"
        from config.settings import Config
        self.client = QdrantClient(
            url=Config.QDRANT_URL if hasattr(Config, 'QDRANT_URL') else "http://localhost:6333", 
            prefer_grpc=False
        )
        self.collection = "knowledge" # Tên collection test

    def upsert(self, point_id, vector, payload):
        # Tự động tạo collection nếu chưa có (để test không bị lỗi)
        self._ensure_collection()
        
        self.client.upsert(
            collection_name=self.collection,
            points=[
                models.PointStruct(id=point_id, vector=vector, payload=payload)
            ]
        )

    def _ensure_collection(self):
        try:
            cols = self.client.get_collections().collections
            if not any(c.name == self.collection for c in cols):
                self.client.create_collection(
                    collection_name=self.collection,
                    vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE)
                )
        except:
            pass

    def search(self, vector, limit=5):
        return self.client.search(
            collection_name=self.collection,
            query_vector=vector,
            limit=limit,
            with_payload=True
        )