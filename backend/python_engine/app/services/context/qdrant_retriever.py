from typing import Optional, List, Any
from app.connect.qdrant_client import QdrantService
from qdrant_client.http import models

class QdrantRetriever:
    def __init__(self, qdrant_service: QdrantService):
        self.qdrant = qdrant_service

    def search(self, vector: List[float], limit: int = 5, symbol: Optional[str] = None) -> List[dict]:
        """
        Tìm kiếm ngữ cảnh dựa trên vector (Semantic Search)
        """
        query_filter = None
        
        if symbol:
            # Fix: Sử dụng cấu trúc Filter chuẩn của Qdrant
            query_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="symbol",
                        match=models.MatchValue(value=symbol.upper())
                    )
                ]
            )
            
        search_result = self.qdrant.search(
            vector=vector, 
            limit=limit, 
            query_filter=query_filter
        )
        
        # Chuyển đổi kết quả sang dạng list dict đồng nhất
        return [
            {
                "id": hit.id,
                "score": hit.score,
                "payload": hit.payload
            } for hit in search_result
        ]