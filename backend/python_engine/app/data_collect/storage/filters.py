import re

class FinancialNewsFilter:
    def __init__(self):
        # 1. Tập từ khóa cấm (Tin tổng hợp, nhận định cá nhân)
        self.blacklist_patterns = re.compile(
            r'(?i)(zacks rank|should you buy|stock of the day|market wrap|what to watch|'
            r'opinion|dow jones|s&p 500|wall street fell|wall street hits|buy or sell|'
            r'is it too late|top stocks|stocks to watch)'
        )
        
        # 2. Tập từ khóa sự kiện bắt buộc phải có (Financial Triggers)
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

        # RÀO CẢN 1: Bắt buộc Ticker hoặc Tên công ty phải có trong Tiêu đề
        # Dùng regex \b để bắt ranh giới từ (tránh nhầm "A" với "Apple")
        if not (re.search(rf'\b{symbol_lower}\b', title_lower) or 
                (len(name_lower) > 2 and name_lower in title_lower)):
            return False

        # RÀO CẢN 2: Chặn Clickbait & Tin tổng hợp
        if self.blacklist_patterns.search(title_lower):
            return False

        # RÀO CẢN 3: Mật độ (Ít nhất 3 lần nhắc đến trong bài)
        mention_count = len(re.findall(rf'\b{symbol_lower}\b', content_lower)) + content_lower.count(name_lower)
        if mention_count < 3:
            return False

        # RÀO CẢN 4: Bắt buộc phải chứa từ khóa mang tính "Sự kiện"
        if not self.event_triggers.search(title_lower) and not self.event_triggers.search(content_lower[:500]):
            return False

        return True

# Cách sử dụng trong file Crawler của bạn:
# filter_engine = FinancialNewsFilter()
# is_valid = filter_engine.is_valuable_event(doc['title'], doc['content'], "NVDA", "Nvidia")
# if not is_valid: continue # Bỏ qua, không lưu vào DB