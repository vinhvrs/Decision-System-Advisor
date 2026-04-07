from datetime import datetime, timezone
import math

class ContextMerger:
    def merge(self, vector_results: list, elastic_results: list) -> list:
        """Merge Qdrant (vector) and Elasticsearch (keyword) hits with weighted scoring."""
        merged = {}

        # 1) Vector (Qdrant) hits
        for v in vector_results:
            uid = v.get('payload', {}).get('chunk_id') or v.get('id')
            merged[uid] = {
                "id": uid, 
                "v_score": v.get('score', 0), 
                "e_score": 0,
                "payload": v.get('payload', {})
            }

        # 2) Keyword (Elasticsearch) hits
        for e in elastic_results:
            uid = e['id']
            if uid not in merged:
                merged[uid] = {
                    "id": uid, 
                    "v_score": 0, 
                    "e_score": e.get('score', 0), 
                    "payload": e.get('payload', {})
                }
            else:
                merged[uid]["e_score"] = e.get('score', 0)

        # 3) Hybrid score
        for item in merged.values():
            # Cap/normalize ES score so it does not dominate vector score
            norm_e_score = min(item['e_score'] / 50.0, 1.0)

            # 55% semantic + 35% keyword + 10% recency
            recency = self._recency_boost(item['payload'].get('published_at'))
            
            item['final_score'] = (
                (0.55 * item['v_score']) + 
                (0.35 * norm_e_score) + 
                (0.10 * recency)
            )

        # Sort by final_score descending
        results = list(merged.values())
        results.sort(key=lambda x: x['final_score'], reverse=True)
        
        return results

    def _recency_boost(self, published_at: str) -> float:
        """Recency boost in [0, 1] from ISO published_at."""
        if not published_at:
            return 0.0
        
        try:
            # Expect ISO-8601, e.g. 2023-10-27T10:00:00Z
            pub_date = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            
            diff_days = (now - pub_date).days
            
            if diff_days < 0:
                return 1.0  # future-dated payload; treat as fresh

            # Exponential decay (~strong within a week, fades by ~30d)
            return math.exp(-diff_days / 14.0) 
        except:
            return 0.0