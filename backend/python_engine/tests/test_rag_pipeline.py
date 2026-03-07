import asyncio
import uuid
from app.data_collect.collectors.news_crawler import db_conn, crawl_symbol
from backend.python_engine.app.services.embedding.embedding_service import embedding_service
from app.connect.qdrant_client import QdrantService

async def test_full_rag_flow(symbol="AAPL"):
    print(f"--- 1. Cào tin tức cho {symbol} ---")
    conn = db_conn()
    # news_crawler.py đã có hàm crawl_symbol xử lý việc cào và lưu MySQL
    stats = crawl_symbol(conn, symbol, set())
    print(f"Kết quả crawl: {stats}")

    if stats['inserted'] == 0:
        print("Không có tin mới, lấy tin cũ từ DB để test...")
    
    # --- 2. Lấy dữ liệu từ knowledge_docs để xử lý LLM ---
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, content, title FROM knowledge_docs 
            WHERE category='article' ORDER BY created_at DESC LIMIT 1
        """)
        doc = cur.fetchone()

    if not doc:
        print("❌ Lỗi: Không tìm thấy dữ liệu trong knowledge_docs")
        return

    print(f"--- 2. Chia nhỏ văn bản (Chunking) & Embedding ---")
    full_text = f"Title: {doc['title']}\nContent: {doc['content']}"
    
    # Chia nhỏ văn bản đơn giản (Knowledge Chunks)
    # Trong thực tế bạn có thể dùng RecursiveCharacterTextSplitter
    chunks = [full_text[i:i+1000] for i in range(0, len(full_text), 800)]
    print(f"Đã chia thành {len(chunks)} chunks.")

    qdrant = QdrantService()

    for i, chunk in enumerate(chunks):
        # Gọi sang embed.py (FastAPI) qua main.py
        print(f"Đang xử lý chunk {i+1}...")
        vector_data = await embedding_service.embed(chunk)
        
        # Vì embed.py trả về dict {'vector': [...], 'model': ...}
        vector = vector_data['vector'] if isinstance(vector_data, dict) else vector_data

        # --- 3. Đưa vào Qdrant (Knowledge) ---
        point_id = str(uuid.uuid4())
        payload = {
            "doc_id": doc['id'],
            "symbol": symbol,
            "text": chunk,
            "chunk_idx": i,
            "source": "yahoo_finance"
        }
        
        qdrant.upsert(point_id, vector, payload)
        print(f"✅ Đã lưu Point {point_id} vào Qdrant.")

    print("\n🚀 TEST FLOW HOÀN TẤT!")

if __name__ == "__main__":
    asyncio.run(test_full_rag_flow("TSLA"))