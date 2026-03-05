# config/dictionaries/phrases.py

PHRASES = {
    "prefix": {
        "spoken_professional": [
            "Based on the current technical setup,",
            "From a technical analysis perspective,",
            "Looking at the latest indicators,",
        ],
        "spoken_casual": [
            "Right now,",
            "At the moment,",
            "From what the charts show,",
        ],
    },
    "momentum": {
        "strong": ["momentum is accelerating", "buying pressure is strengthening"],
        "moderate": ["momentum remains moderate", "directional strength is limited"],
        "weak": ["momentum appears weak", "directional conviction is lacking"],
    },
    "confidence_tone": {
        "high": ["with strong conviction", "with a high degree of confidence"],
        "low": ["with limited conviction", "with a higher degree of uncertainty"],
    }
}

CONNECTORS = {
    "neutral": ["while", "however", "at the same time"],
    "supportive": ["supported by", "in line with", "reinforced by"],
    "contrast": ["despite", "although", "even though"],
}

ERROR_MESSAGES = {
    "unknown_intent": "Sorry, I could not clearly understand your request.",
    "missing_entity": "I need a specific stock or market to proceed.",
    "no_data": "Data is currently unavailable for this request.",
}