# config/dictionaries/logic.py

STRATEGY = {
    "news_request": {"mode": "informative", "require_data": True, "allow_llm": False},
    "price_request": {"mode": "direct", "require_data": True, "allow_llm": False},
    "indicator_request": {"mode": "analytical", "require_data": True, "allow_llm": True},
    "buy_decision": {"mode": "advisory", "require_data": True, "allow_llm": True},
    "sell_decision": {"mode": "advisory", "require_data": True, "allow_llm": True},
    "unknown": {"mode": "fallback", "require_data": False, "allow_llm": True},
    
    # Action verbs
    "verbs": ["give", "show", "get", "tell", "list", "analyze", "recommend", "buy", "sell", "check", "view", "use", "using"],
    
    # Fillers
    "fillers": ["me", "please", "today", "now", "full", "include", "latest", "current"],
    
    # Negations and Navigation
    "negations": [
        "no", "not", "without", "dont", "don't", "ignore", 
        "stop", "except", "instead", "but", "never", "none"
    ],
    
    # Domain Nouns
    "domain_nouns": ["stock", "stocks", "price", "prices", "analysis", "text", "market", "chart", "data", "info"],
    
    # UPDATED BLACKLIST: Added "USING", "USE", "ANALYZE" to prevent ticker misidentification
    "noise_blacklist": [
        "NEED", "IGNORE", "STOP", "WHAT", "HOW", "SHOW", "LIST", "USING", "USE", "ANALYZE",
        "THE", "AND", "WITH", "FOR", "THIS", "THAT", "INFO", "DATA", "STOCK",
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