# config/dictionaries/constants.py

TYPOS = {
    'volitility': 'volatility', 'volatilty': 'volatility',
    'ohclv': 'ohlcv', 'pls': 'please', 'plz': 'please'
}

STRATEGY = {
    'news_request': {'mode': 'informative', 'require_data': True, 'allow_llm': False},
    'price_request': {'mode': 'direct', 'require_data': True, 'allow_llm': False},
    'buy_decision': {'mode': 'advisory', 'require_data': True, 'allow_llm': True},
    'sell_decision': {'mode': 'advisory', 'require_data': True, 'allow_llm': True},
    'unknown': {'mode': 'fallback', 'require_data': False, 'allow_llm': True},
    'verbs': ['give', 'show', 'get', 'tell', 'analyze', 'recommend'],
    'fillers': ['me', 'please', 'today', 'now'],
    'negations': ['no', 'not', 'without']
}

INTENT_PHRASES = {
    'news_request': ['news', 'headline', 'update'],
    'price_request': ['price', 'stock price'],
    'buy_decision': ['buy', 'entry', 'long'],
    'sell_decision': ['sell', 'exit', 'short']
}