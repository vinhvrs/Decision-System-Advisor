import httpx
import logging
from typing import List, Optional
from config.settings import settings

class ElasticRetriever:
    def __init__(self):
        self.url = settings.ELASTIC_HOST.rstrip('/')
        self.index = settings.ELASTIC_INDEX
        self.logger = logging.getLogger(__name__)

    async def search(self, query: str, limit: int = 10, symbol: Optional[str] = None) -> List[dict]:
        """
        Tìm kiếm từ khóa (Full-text search) trên Elasticsearch
        """
        body = {
            "size": limit,
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["title^3", "content", "summary"],
                                "type": "best_fields"
                            }
                        }
                    ],
                    "filter": []
                }
            },
            "sort": [{"_score": "desc"}]
        }

        if symbol:
            # Lọc chính xác theo mã chứng khoán (data.symbol.keyword)
            body["query"]["bool"]["filter"].append({
                "term": {"data.symbol.keyword": symbol.upper()}
            })

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.url}/{self.index}/_search",
                    json=body,
                    timeout=10.0
                )
                response.raise_for_status()
                res_json = response.json()

                hits = res_json.get('hits', {}).get('hits', [])
                return [
                    {
                        "id": hit["_id"],
                        "score": hit["_score"],
                        "payload": hit["_source"]
                    } for hit in hits
                ]
        except Exception as e:
            self.logger.error(f"Elasticsearch Search Error: {e}")
            return []
