import uuid
import json
import logging
import asyncio
from datetime import datetime
from app.data_collect.collectors.news_crawler import db_conn, crawl_symbol
from app.connect.qdrant_client import QdrantService
from app.services.embedding.embedding_service import embedding_service
from config.settings import Config

class RAGPipeline:
    def __init__(self):
        self.qdrant = QdrantService()
        self.logger = logging.getLogger(__name__)

    async def run_for_symbol(self, symbol: str):
        conn = db_conn()
        processed_count = 0
        try:
            # 1. CRAWL: Cào tin mới
            with conn.cursor() as cur:
                cur.execute("SELECT source FROM knowledge_docs WHERE category='article' AND source IS NOT NULL")
                existing_sources = {r["source"] for r in cur.fetchall()}
            
            stats = crawl_symbol(conn, symbol, existing_sources)
            print(f"   -> Crawler: {stats}")
            
            # 2. FETCH: Lấy tin chưa xử lý (is_processed = 0)
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, title, content FROM knowledge_docs 
                    WHERE category='article' AND (is_processed = 0 OR is_processed IS NULL)
                    ORDER BY created_at DESC LIMIT 5
                """)
                new_articles = cur.fetchall()

            # 3. EMBED & SAVE
            for article in new_articles:
                knowledge_id = article['id']
                content_to_embed = f"{article['title']}. {article['content']}"
                
                # Gọi Embedding Service (8000)
                vector = await embedding_service.embed(content_to_embed[:2000])
                
                # Kiểm tra vector hợp lệ (không phải toàn 0 do lỗi)
                if vector and any(v != 0 for v in vector[:10]):
                    chunk_id = str(uuid.uuid4())
                    
                    with conn.cursor() as cur:
                        # Lưu MySQL knowledge_chunks
                        cur.execute("""
                            INSERT INTO knowledge_chunks (id, docs_id, knowledge_id, content, vector, chunk_index, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """, (
                            chunk_id, 
                            article['id'],    # Lưu ID của bài báo vào đúng cột docs_id
                            None,             # Để trống knowledge_id vì dữ liệu này lấy từ docs
                            article['content'][:1000], 
                            json.dumps(vector), 
                            0,                # Giá trị mặc định cho chunk_index
                            datetime.now()
                        ))
                        cur.execute("UPDATE knowledge_docs SET is_processed = 1 WHERE id = %s", (knowledge_id,))
                    
                    # 4. Đẩy Qdrant
                    self.qdrant.upsert(
                        point_id=chunk_id,
                        vector=vector,
                        payload={
                            "docs_id": article['id'],
                            "symbol": symbol,
                            "title": article['title']
                        }
                    )
                    
                    # 5. CẬP NHẬT TRẠNG THÁI VÀO MYSQL
                    with conn.cursor() as cur:
                        cur.execute("""
                            UPDATE knowledge_chunks 
                            SET qdrant_point_id = %s, qdrant_upserted_at = %s 
                            WHERE id = %s
                        """, (chunk_id, datetime.now(), chunk_id))

                    processed_count += 1
            
            conn.commit()
            return {"symbol": symbol, "processed": processed_count}
            
        except Exception as e:
            self.logger.error(f"Pipeline Error: {e}")
            conn.rollback()
            return {"symbol": symbol, "processed": 0, "error": str(e)}
        finally:
            conn.close()

pipeline_manager = RAGPipeline()