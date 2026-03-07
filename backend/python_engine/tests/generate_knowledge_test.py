import json
import os
import uuid
from datetime import datetime
from app.data_collect.collectors.news_crawler import db_conn

def retrieve_news_for_timeline(symbol, days=30):
    """Lấy tin tức trong vòng 30 ngày qua để dựng timeline"""
    conn = db_conn()
    context_text = ""
    source_ids = []
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, title, content, created_at 
                FROM knowledge_docs 
                WHERE symbol = %s AND created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
                ORDER BY created_at ASC
            """, (symbol, days))
            docs = cur.fetchall()
            for doc in docs:
                source_ids.append(doc['id'])
                # Format text để LLM dễ bóc tách thực thể
                context_text += f"| DATE: {doc['created_at']} | HEADLINE: {doc['title']} | BODY: {doc['content'][:500]}... |\n"
        return context_text, source_ids
    finally:
        conn.close()

def generate_event_timeline(symbol):
    context, all_source_ids = retrieve_news_for_timeline(symbol)
    
    # Prompt ép LLM trả về Structured Data (JSON format)
    # Đây là chìa khóa để sau này bạn chạy thuật toán Non-AI (như tìm kiếm theo từ khóa)
    prompt = f"""
    Analyze the financial news for {symbol} and construct a Chronological Event Timeline.
    
    Context:
    {context}
    
    For each distinct market-moving event, extract the following fields in ENGLISH:
    1. event_type: (Choose one: Earnings, Product, Macro, Regulatory, Management, Sentiment)
    2. event_date: YYYY-MM-DD
    3. impact_score: Scale -1.0 (Very Negative) to 1.0 (Very Positive)
    4. volatility_expectation: (Low, Medium, High)
    5. description: Concise summary of what happened.
    6. historical_precedent: Identify if this event mirrors a past occurrence (e.g., "Post-earnings rally pattern").

    Output the result as a raw JSON list only.
    """

    # --- GIẢ LẬP KẾT QUẢ TỪ LLM (Structured JSON) ---
    # Trong thực tế, bạn sẽ dùng response = llm.invoke(prompt)
    mock_events = [
        {
            "event_id": str(uuid.uuid4()),
            "event_date": "2026-03-05",
            "event_type": "Earnings",
            "impact_score": 0.85,
            "volatility_expectation": "High",
            "description": f"{symbol} reported Q4 revenue growth of 25%, beating Wall Street estimates.",
            "historical_precedent": "Similar to Q4-2024 beat which led to a 12% price surge in 5 days."
        },
        {
            "event_id": str(uuid.uuid4()),
            "event_date": "2026-03-07",
            "event_type": "Macro",
            "impact_score": -0.3,
            "volatility_expectation": "Medium",
            "description": "Federal Reserve hinted at prolonged high interest rates, affecting tech sector liquidity.",
            "historical_precedent": "Matches the 'Rate-Hike Scare' pattern of mid-2023."
        }
    ]

    # 4. Lưu ra file output cùng thư mục
    final_output = {
        "symbol": symbol,
        "total_sources_analyzed": len(all_source_ids),
        "events": mock_events,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    output_file = f"timeline_{symbol.lower()}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(final_output, f, indent=4)
    
    print(f"✅ Event Timeline saved to {output_file}")

if __name__ == "__main__":
    generate_event_timeline("NVDA")