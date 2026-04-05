import re

class FinancialNewsFilter:
    def __init__(self):
        # 1) Blacklist: wrap-ups, opinion pieces, generic market chatter
        self.blacklist_patterns = re.compile(
            r'(?i)(zacks rank|should you buy|stock of the day|market wrap|what to watch|'
            r'opinion|dow jones|s&p 500|wall street fell|wall street hits|buy or sell|'
            r'is it too late|top stocks|stocks to watch)'
        )
        
        # 2) Event triggers (financial / corporate actions)
        self.event_triggers = re.compile(
            r'(?i)(earnings|revenue|guidance|q[1-4]|dividend|launches|unveils|'
            r'acquires|merger|partnership|secures|resigns|steps down|lawsuit|sued|'
            r'fda approval|layoffs|cuts jobs|bankruptcy)'
        )

    def is_valuable_event(self, title: str, content: str, symbol: str, company_short_name: str) -> bool:
        title_lower = title.lower()
        content_lower = content.lower()
        symbol_lower = symbol.lower()
        name_lower = company_short_name.lower()

        # Gate 1: Title must mention ticker or company name (word boundaries)
        if not (re.search(rf'\b{symbol_lower}\b', title_lower) or 
                (len(name_lower) > 2 and name_lower in title_lower)):
            return False

        # Gate 2: Drop clickbait / wrap-up titles
        if self.blacklist_patterns.search(title_lower):
            return False

        # Gate 3: Minimum mention density in body
        mention_count = len(re.findall(rf'\b{symbol_lower}\b', content_lower)) + content_lower.count(name_lower)
        if mention_count < 3:
            return False

        # Gate 4: Must contain an event-style keyword (title or lead of body)
        if not self.event_triggers.search(title_lower) and not self.event_triggers.search(content_lower[:500]):
            return False

        return True

# Example:
# filter_engine = FinancialNewsFilter()
# is_valid = filter_engine.is_valuable_event(doc['title'], doc['content'], "NVDA", "Nvidia")
# if not is_valid: continue