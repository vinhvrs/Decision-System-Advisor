from typing import Optional, List, Dict, Any
from app.connect.qdrant_client import QdrantService
from qdrant_client.http import models

class QdrantRetriever:
    def __init__(self, qdrant_service: QdrantService):
        self.qdrant = qdrant_service

    async def search(self, vector: List[float], limit: int = 5, symbol: Optional[str] = None) -> List[dict]:
        """Search by embedding; optional symbol filter."""
        query_filter = None
        if symbol:
            query_filter = models.Filter(
                must=[models.FieldCondition(key="symbol", match=models.MatchValue(value=symbol.upper()))]
            )
            
        search_result = await self.qdrant.search(
            query_vector=vector, 
            limit=limit, 
            query_filter=query_filter
        )
        
        return [{"id": hit.id, "score": hit.score, "payload": hit.payload, "source": "qdrant"} for hit in search_result]