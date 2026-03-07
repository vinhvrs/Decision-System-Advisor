import json
import os
import uuid
from datetime import datetime
from app.data_collect.collectors.news_crawler import db_conn

def retrieve_historical_context(symbol, limit=15):
    """Lấy dữ liệu tin tức thô để AI bóc tách sự kiện."""
    conn = db_conn()
    context_text = ""
    source_ids = []
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, title, content, created_at 
                FROM knowledge_docs 
                WHERE symbol = %s 
                ORDER BY created_at ASC 
                LIMIT %s
            """, (symbol, limit))
            docs = cur.fetchall()
            for doc in docs:
                source_ids.append(doc['id'])
                # Format chặt chẽ để AI không bị lẫn lộn mốc thời gian
                context_text += f"[DATE: {doc['created_at']}] TITLE: {doc['title']} | CONTENT: {doc['content'][:300]}...\n"
        return context_text, source_ids
    finally:
        conn.close()

def generate_timeline(symbol):
    context, all_ids = retrieve_historical_context(symbol)
    
    # PROMPT: Ép LLM đóng vai trò là một Data Extractor
    prompt = f"""
    Analyze the financial news for {symbol}. Your goal is to identify KEY MARKET EVENTS for a timeline.
    
    Context:
    {context}
    
    STRICT INSTRUCTIONS:
    1. Identify only major events (Earnings, Product Launch, Macro Policy, M&A).
    2. For each event, output a JSON object with these fields:
       - event_date: (YYYY-MM-DD)
       - event_type: (Choose: EARNINGS, PRODUCT, MACRO, REGULATORY, MANAGEMENT)
       - sentiment_score: (-1.0 to 1.0)
       - impact_magnitude: (LOW, MEDIUM, HIGH)
       - description: (One sentence summary)
       - pattern_id: (A short label to group similar past events, e.g., 'POST_EARNINGS_DIP')
    
    Output Format: A raw JSON list of events.
    """

    # --- GIẢ LẬP KẾT QUẢ LLM TRẢ VỀ ---
    # Trong thực tế, bạn sẽ dùng: response = llm_call(prompt)
    mock_events = [
        {
            "event_id": str(uuid.uuid4()),
            "event_date": "2026-03-05",
            "event_type": "EARNINGS",
            "sentiment_score": 0.85,
            "impact_magnitude": "HIGH",
            "description": f"{symbol} reported record revenue growth driven by AI data center demand.",
            "pattern_id": "EARNINGS_BEAT_MOMENTUM"
        },
        {
            "event_id": str(uuid.uuid4()),
            "event_date": "2026-03-07",
            "event_type": "MACRO",
            "sentiment_score": -0.4,
            "impact_magnitude": "MEDIUM",
            "description": "Hawkish Fed comments regarding inflation outlook put pressure on tech valuations.",
            "pattern_id": "INTEREST_RATE_SENSITIVITY"
        }
    ]

    # 4. Lưu ra file JSON Timeline (All-in-English)
    timeline_data = {
        "symbol": symbol,
        "analysis_period": "Past 15 articles",
        "events": mock_events,
        "metadata": {
            "source_count": len(all_ids),
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    }

    output_file = f"timeline_{symbol.lower()}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(timeline_data, f, indent=4)
    
    print(f"✅ Event Timeline for {symbol} saved to: {output_file}")

if __name__ == "__main__":
    generate_timeline("NVDA")