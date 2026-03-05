# config/dictionaries/mapping.py

INTENTS = {
    "news_request": ["news", "headline", "update"],
    "analysis_request": ["analysis", "analyze", "price analysis", "stock analysis"],
    "price_request": ["price", "prices", "stock price"],
    "indicator_request": ["indicator", "macd", "rsi", "ohlcv"],
    "buy_decision": ["buy", "entry", "long"],
    "sell_decision": ["sell", "exit", "short"],
}

INDICATORS = {
    "ohlcv": {"type": "price_series", "description": "Open High Low Close Volume"},
    "macd": {"type": "momentum", "description": "Moving Average Convergence Divergence"},
    "rsi": {"type": "momentum", "description": "Relative Strength Index"},
}