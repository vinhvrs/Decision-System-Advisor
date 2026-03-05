from datetime import datetime, timezone
import math

class ContextMerger:
    def merge(self, vector_results: list, elastic_results: list) -> list:
        """
        Hợp nhất kết quả từ Qdrant và Elasticsearch bằng phương pháp weighted scoring
        """
        merged = {}

        # 1. Xử lý kết quả từ Vector (Qdrant)
        for v in vector_results:
            uid = v.get('payload', {}).get('chunk_id') or v.get('id')
            merged[uid] = {
                "id": uid, 
                "v_score": v.get('score', 0), 
                "e_score": 0,
                "payload": v.get('payload', {})
            }

        # 2. Xử lý kết quả từ Keyword (Elastic)
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

        # 3. Tính toán điểm cuối (Final Hybrid Score)
        for item in merged.values():
            # Normalize Elastic score (thường lớn) về scale nhỏ hơn để tránh áp đảo Vector score
            norm_e_score = min(item['e_score'] / 50.0, 1.0) 
            
            # Trọng số: 55% Semantic + 35% Keyword + 10% Recency
            recency = self._recency_boost(item['payload'].get('published_at'))
            
            item['final_score'] = (
                (0.55 * item['v_score']) + 
                (0.35 * norm_e_score) + 
                (0.10 * recency)
            )

        # Chuyển về list và sắp xếp theo điểm cao nhất
        results = list(merged.values())
        results.sort(key=lambda x: x['final_score'], reverse=True)
        
        return results

    def _recency_boost(self, published_at: str) -> float:
        """
        Tính điểm cộng dựa trên độ mới của tài liệu (từ 0.0 đến 1.0)
        """
        if not published_at:
            return 0.0
        
        try:
            # Giả định published_at có định dạng ISO: 2023-10-27T10:00:00Z
            pub_date = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            
            diff_days = (now - pub_date).days
            
            if diff_days < 0: return 1.0 # Tin tương lai (lỗi data)
            
            # Decay function: Tin trong vòng 7 ngày được điểm cao, sau 30 ngày về gần 0
            return math.exp(-diff_days / 14.0) 
        except:
            return 0.0