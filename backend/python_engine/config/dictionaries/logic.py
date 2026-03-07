# config/dictionaries/logic.py

STRATEGY = {
    "news_request": {"mode": "informative", "require_data": True, "allow_llm": False},
    "price_request": {"mode": "direct", "require_data": True, "allow_llm": False},
    "indicator_request": {"mode": "analytical", "require_data": True, "allow_llm": True},
    "buy_decision": {"mode": "advisory", "require_data": True, "allow_llm": True},
    "sell_decision": {"mode": "advisory", "require_data": True, "allow_llm": True},
    "unknown": {"mode": "fallback", "require_data": False, "allow_llm": True},
    
    # Động từ hành động
    "verbs": ["give", "show", "get", "tell", "list", "analyze", "recommend", "buy", "sell", "check", "view"],
    
    # Từ đệm
    "fillers": ["me", "please", "today", "now", "full", "include", "latest", "current"],
    
    # TẦNG PHỦ ĐỊNH & ĐIỀU HƯỚNG (Quan trọng cho Semantic Tree)
    "negations": [
        "no", "not", "without", "dont", "don't", "ignore", 
        "stop", "except", "instead", "but", "never", "none"
    ],
    
    # Danh từ miền (Domain Nouns)
    "domain_nouns": ["stock", "stocks", "price", "prices", "analysis", "text", "market", "chart", "data", "info"],
    
    # Danh sách BLACKLIST chặn bắt nhầm Ticker (Fix lỗi NEED, IGNORE...)
    "noise_blacklist": [
        "NEED", "IGNORE", "STOP", "WHAT", "HOW", "SHOW", "LIST", 
        "THE", "AND", "WITH", "FOR", "THIS", "THAT", "INFO", "DATA",
        "CAN", "WAS", "ARE", "HAS", "BEEN", "WILL"
    ]
}

TYPOS = {
    "volitility": "volatility",
    "volatilty": "volatility",
    "liqidity": "liquidity",
    "volum": "volume",
    "ohclv": "ohlcv",
    "pls": "please",
    "plz": "please",
    "analize": "analyze",
    "ticker": "symbol"
}