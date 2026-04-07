import httpx
import logging
from typing import List, Optional
from config.settings import settings

class ElasticRetriever:
    def __init__(self):
        self.url = settings.ELASTIC_HOST.rstrip('/')
        self.index = settings.ELASTIC_INDEX
        self.logger = logging.getLogger(__name__)
        self.client = httpx.AsyncClient(timeout=10.0)

    async def search(self, query: str, limit: int = 10, symbol: Optional[str] = None) -> List[dict]:
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
            body["query"]["bool"]["filter"].append({
                "term": {"data.symbol.keyword": symbol.upper()}
            })

        try:
            response = await self.client.post(
                f"{self.url}/{self.index}/_search",
                json=body
            )
            response.raise_for_status()
            res_json = response.json()

            hits = res_json.get('hits', {}).get('hits', [])
            return [
                {
                    "id": hit["_id"],
                    "score": hit["_score"],
                    "payload": hit["_source"],
                    "source": "elastic",
                } for hit in hits
            ]
        except Exception as e:
            self.logger.error(f"Elasticsearch Search Error: {e}")
            return []
