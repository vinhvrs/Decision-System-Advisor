import uuid
import json
import logging
import os
from datetime import datetime
from app.data_collect.collectors.news_crawler import db_conn, crawl_symbol, get_company_mapping
from app.connect.qdrant_client import QdrantService
from app.services.embedding.embedding_service import embedding_service

_NEWS_VECTOR_FLAG = os.environ.get("NEWS_VECTOR_ENABLED", "0").strip().lower()
NEWS_VECTOR_ENABLED = _NEWS_VECTOR_FLAG in ("1", "true", "yes", "on")


class RAGPipeline:
    def __init__(self):
        self.qdrant = QdrantService()
        self.logger = logging.getLogger(__name__)

    async def run_for_symbol(self, symbol: str):
        conn = db_conn()
        processed_count = 0
        try:
            # 1) Crawl new headlines
            with conn.cursor() as cur:
                cur.execute("SELECT source FROM knowledge_docs WHERE category='article' AND source IS NOT NULL")
                existing_sources = {r["source"] for r in cur.fetchall()}

            company_mapping = get_company_mapping(conn)
            stats = crawl_symbol(conn, symbol, existing_sources, company_mapping)
            print(f"   -> Crawler: {stats}")

            if not NEWS_VECTOR_ENABLED:
                self.logger.info(
                    "News vector analyze disabled (NEWS_VECTOR_ENABLED=%r); skipping embed+Qdrant.",
                    _NEWS_VECTOR_FLAG or "0",
                )
                return {"symbol": symbol, "processed": 0, "vector_analyze_disabled": True}
            
            # 2) Unprocessed articles
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, title, content FROM knowledge_docs 
                    WHERE category='article' AND (is_processed = 0 OR is_processed IS NULL)
                    ORDER BY created_at DESC LIMIT 5
                """)
                new_articles = cur.fetchall()

            # 3) Embed and persist chunks
            for article in new_articles:
                knowledge_id = article['id']
                content_to_embed = f"{article['title']}. {article['content']}"
                
                # Embedding service
                vector = await embedding_service.embed(content_to_embed[:2000])
                
                # Skip zero vectors (failed embed)
                if vector and any(v != 0 for v in vector[:10]):
                    chunk_id = str(uuid.uuid4())
                    
                    with conn.cursor() as cur:
                        # knowledge_chunks row
                        cur.execute("""
                            INSERT INTO knowledge_chunks (id, docs_id, knowledge_id, content, vector, chunk_index, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """, (
                            chunk_id, 
                            article['id'],
                            None,  # knowledge_id unused for docs-sourced rows
                            article['content'][:1000], 
                            json.dumps(vector), 
                            0,
                            datetime.now()
                        ))
                        cur.execute("UPDATE knowledge_docs SET is_processed = 1 WHERE id = %s", (knowledge_id,))
                    
                    # 4) Qdrant upsert
                    await self.qdrant.upsert(
                        point_id=chunk_id,
                        vector=vector,
                        payload={
                            "docs_id": article['id'],
                            "symbol": symbol,
                            "title": article['title'],
                        },
                    )
                    
                    # 5) Mark chunk upserted in MySQL
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

    async def embed_unprocessed_knowledge_docs(self, limit: int = 40) -> dict:
        """
        Process ``knowledge_docs`` with is_processed=0: embed → ``knowledge_chunks`` → Qdrant.
        Does not fetch GDELT (scheduled separately via ``news_handle.run_daily_update``).
        """
        if not NEWS_VECTOR_ENABLED:
            self.logger.info(
                "News vector analyze disabled (NEWS_VECTOR_ENABLED=%r); skip embed_unprocessed_knowledge_docs.",
                _NEWS_VECTOR_FLAG or "0",
            )
            return {"processed": 0, "vector_analyze_disabled": True}

        conn = db_conn()
        processed_count = 0
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, title, content, symbol FROM knowledge_docs
                    WHERE category = 'article'
                      AND (is_processed = 0 OR is_processed IS NULL)
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (limit,),
                )
                rows = cur.fetchall()

            for article in rows:
                doc_pk = article["id"]
                sym = (article.get("symbol") or "").strip().upper() or "GENERAL"
                body = (article.get("content") or "")[:2000]
                headline = article.get("title") or ""
                content_to_embed = f"{headline}. {body}".strip()
                if len(content_to_embed) < 20:
                    continue

                try:
                    vector = await embedding_service.embed(content_to_embed[:2000])
                except Exception as exc:
                    self.logger.warning("Embedding failed for doc %s: %s", doc_pk, exc)
                    continue

                if not vector or not any(v != 0 for v in vector[:10]):
                    continue

                chunk_id = str(uuid.uuid4())
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO knowledge_chunks (id, docs_id, knowledge_id, content, vector, chunk_index, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                chunk_id,
                                doc_pk,
                                None,
                                (article.get("content") or "")[:1000],
                                json.dumps(vector),
                                0,
                                datetime.now(),
                            ),
                        )
                        cur.execute(
                            "UPDATE knowledge_docs SET is_processed = 1 WHERE id = %s",
                            (doc_pk,),
                        )

                    await self.qdrant.upsert(
                        point_id=chunk_id,
                        vector=vector,
                        payload={
                            "docs_id": doc_pk,
                            "symbol": sym,
                            "title": headline,
                        },
                    )

                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            UPDATE knowledge_chunks
                            SET qdrant_point_id = %s, qdrant_upserted_at = %s
                            WHERE id = %s
                            """,
                            (chunk_id, datetime.now(), chunk_id),
                        )
                    conn.commit()
                    processed_count += 1
                except Exception as exc:
                    self.logger.error(
                        "Embed/Qdrant failed for doc %s: %s", doc_pk, exc, exc_info=True
                    )
                    conn.rollback()

            return {"processed": processed_count}
        except Exception as e:
            self.logger.error("embed_unprocessed_knowledge_docs: %s", e, exc_info=True)
            conn.rollback()
            return {"processed": processed_count, "error": str(e)}
        finally:
            conn.close()


pipeline_manager = RAGPipeline()