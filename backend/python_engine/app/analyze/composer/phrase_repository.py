class PhraseRepository:
    @staticmethod
    def intro(decision: str) -> list[str]:
        mapping = {
            'BUY': [
                'The stock shows a positive technical outlook.',
                'Overall technical indicators suggest a favorable condition.',
                'Current chart patterns lean towards a bullish bias.'
            ],
            'SELL': [
                'The stock exhibits signs of technical weakness.',
                'Technical indicators point to increasing downside risk.',
                'The bearish momentum appears to be overriding at this stage.'
            ]
        }
        return mapping.get(decision.upper(), [
            'The market is currently showing mixed technical signals.',
            'No dominant technical direction is observed at this stage.'
        ])

    @staticmethod
    def trend(trend_type: str) -> list[str]:
        if trend_type == 'bullish':
            return ['Trend indicators suggest upward movement.', 'The prevailing trend remains positive.']
        if trend_type == 'bearish':
            return ['Trend indicators indicate downward pressure.', 'A negative trend is currently observed.']
        return ['No clear directional trend has been established.']

    @staticmethod
    def confidence(score: int) -> list[str]:
        if score >= 75:
            return ['This signal is backed by high technical conviction.']
        if score >= 50:
            return ['The confidence level for this setup is moderate.']
        return ['Note that this signal has relatively low technical confidence.']