STRATEGY = {
    "news_request": {"mode": "informative", "require_data": True, "allow_llm": False},
    "price_request": {"mode": "direct", "require_data": True, "allow_llm": False},
    "indicator_request": {"mode": "analytical", "require_data": True, "allow_llm": True},
    "buy_decision": {"mode": "advisory", "require_data": True, "allow_llm": True},
    "sell_decision": {"mode": "advisory", "require_data": True, "allow_llm": True},
    "unknown": {"mode": "fallback", "require_data": False, "allow_llm": True},
    
    "verbs": ["give", "show", "get", "tell", "list", "analyze", "recommend", "buy", "sell"],
    "fillers": ["me", "please", "today", "now", "full", "include"],
    "negations": ["no", "not", "without"],
    # Bổ sung domain_nouns từ strategy.php
    "domain_nouns": ["stock", "stocks", "price", "prices", "analysis", "text", "market", "chart"]
}

TYPOS = {
    "volitility": "volatility",
    "volatilty": "volatility",
    "ohclv": "ohlcv",
    "pls": "please",
    "plz": "please",
}