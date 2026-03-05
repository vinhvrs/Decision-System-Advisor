# app/connect/qdrant_client.py
from qdrant_client import QdrantClient
from qdrant_client.http import models
from config.settings import settings

class QdrantService:
    def __init__(self):
        self.client = QdrantClient(url=settings.QDRANT_URL)
        self.collection = settings.QDRANT_COLLECTION

    def search(self, vector: list[float], limit: int = 10, query_filter: dict = None):
        return self.client.search(
            collection_name=self.collection,
            query_vector=vector,
            query_filter=query_filter,
            limit=limit,
            with_payload=True
        )

    def upsert(self, point_id, vector, payload):
        self.client.upsert(
            collection_name=self.collection,
            points=[
                models.PointStruct(id=point_id, vector=vector, payload=payload)
            ]
        )