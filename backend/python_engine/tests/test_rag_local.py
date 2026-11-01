import asyncio
from app.pipeline.orchestrator import pipeline_manager

async def test():
    symbol = "NVDA"
    print(f"--- Khởi động Pipeline cho {symbol} ---")
    
    result = await pipeline_manager.run_for_symbol(symbol)
    
    print(f"--- Hoàn tất! Đã xử lý {result['processed']} bài báo mới ---")

if __name__ == "__main__":
    asyncio.run(test())