import os
import pymysql
from datetime import datetime
from app.pipeline.pipeline_processor import process_docs_to_chunks
from config.settings import Config

def get_ai_prediction_from_history(symbol, current_pre):
    conn = pymysql.connect(**Config.DB_CONFIG)
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # Dùng ALIAS 'avg_post' để truy cập an toàn
            sql = """SELECT AVG(post_trend) as avg_post, COUNT(*) as total 
                     FROM knowledge_inference_results 
                     WHERE symbol = %s AND ABS(pre_trend - %s) <= 1.5"""
            cursor.execute(sql, (symbol, current_pre))
            res = cursor.fetchone()
            
            # Kiểm tra bằng Key name
            if res and res['total'] > 0:
                return res['avg_post']
            return None
    finally: conn.close()

def export_timeline_file(events, symbol):
    if not events:
        print("☕ Không có tin mới để ghi vào Timeline.")
        return
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(current_dir, "timeline.txt")
    
    # Mode 'a' (Append) để tạo timeline tuyến tính không bị ghi đè
    with open(output_path, "a", encoding="utf-8") as f:
        f.write(f"\n--- [PHIÊN CẬP NHẬT: {datetime.now().strftime('%Y-%m-%d %H:%M')}] ---\n")
        for ev in events:
            f.write(f"🕒 Tin ra: {ev['published_at']} | Khớp nến: {ev['trade_date']}\n")
            f.write(f"📉 Pre-Trend (14d): {ev['pre_trend']:+.2f}%\n")
            f.write(f"📰 News: {ev['title']}\n")
            
            # AI soi lại lịch sử
            past_avg = get_ai_prediction_from_history(symbol, ev['pre_trend'])
            if past_avg is not None:
                signal = "🚀 BUY" if past_avg > 1.2 else ("⚠️ SELL" if past_avg < -1.2 else "⚖️ HOLD")
                f.write(f"🤖 AI Memory Recommendation: {signal} (Mẫu tương đương quá khứ biến động {past_avg:+.2f}%)\n")
            
            f.write(f"📈 Post-Trend (7d): {ev['post_trend']:+.2f}%\n")
            f.write("-" * 50 + "\n")
    print(f"✅ Đã nối {len(events)} sự kiện mới vào: {output_path}")

def run_real_test():
    symbol = "NVDA"
    print(f"🚀 BẮT ĐẦU CẬP NHẬT TIMELINE TUYẾN TÍNH: {symbol}")
    
    # 1. Pipeline fetch tin mới và lưu vào DB kết quả
    new_events = process_docs_to_chunks(target_symbol=symbol, test_mode=False)
    
    # 2. Xuất báo cáo Timeline dựa trên sự kiện vừa xử lý
    export_timeline_file(new_events, symbol)

if __name__ == "__main__":
    run_real_test()