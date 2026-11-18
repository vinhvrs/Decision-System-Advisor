"""Curated cross-asset universe. 1mo/monthly means month; 30m means minutes."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Asset:
    symbol: str
    name: str
    market: str
    timezone: str = 'America/New_York'
    session_roll_hour: int = 0
    exchange: str = ''
    cik: str | None = None

    @property
    def asset_class(self) -> str:
        return {'stock': 'EQUITY', 'etf': 'ETF', 'index': 'INDEX', 'forex': 'FX',
                'commodity': 'COMMODITY', 'crypto': 'CRYPTO'}[self.market]

    @property
    def quote_currency(self) -> str:
        return {'JPY=X':'JPY','CHF=X':'CHF','^N225':'JPY','^GDAXI':'EUR'}.get(self.symbol,'USD')

    @property
    def price_unit(self) -> str:
        return 'index_points' if self.market=='index' else self.quote_currency

    @property
    def volume_type(self) -> str:
        return {'stock': 'TRADE_VOLUME', 'etf': 'TRADE_VOLUME', 'index': 'NONE',
                'forex': 'NONE', 'commodity': 'CONTRACT_VOLUME', 'crypto': 'NONE'}[self.market]

    @property
    def benchmark_symbol(self) -> str | None:
        if self.market in ('stock', 'etf'):
            return 'SPY' if self.symbol != 'SPY' else '^GSPC'
        if self.market == 'crypto' and self.symbol != 'BTC-USD':
            return 'BTC-USD'
        return None  # No economically defensible default for this instrument yet.


ASSETS = [
    Asset('AAPL', 'Apple Inc.', 'stock', cik='0000320193'),
    Asset('MSFT', 'Microsoft Corporation', 'stock', cik='0000789019'),
    Asset('NVDA', 'NVIDIA Corporation', 'stock', cik='0001045810'),
    Asset('TSLA', 'Tesla, Inc.', 'stock', cik='0001318605'),
    Asset('GOOGL', 'Alphabet Inc.', 'stock', cik='0001652044'),
    Asset('META', 'Meta Platforms, Inc.', 'stock', cik='0001326801'),
    Asset('AMZN', 'Amazon.com, Inc.', 'stock', cik='0001018724'),
    Asset('IBM', 'International Business Machines Corporation', 'stock', cik='0000051143'),
    Asset('ORCL', 'Oracle Corporation', 'stock', cik='0001341439'),
    Asset('AVGO', 'Broadcom Inc.', 'stock', cik='0001730168'),
    Asset('JPM', 'JPMorgan Chase & Co.', 'stock', cik='0000019617'),
    Asset('JNJ', 'Johnson & Johnson', 'stock', cik='0000200406'),
    Asset('XOM', 'Exxon Mobil Corporation', 'stock', cik='0000034088'),
    Asset('WMT', 'Walmart Inc.', 'stock', cik='0000104169'),
    Asset('CAT', 'Caterpillar Inc.', 'stock', cik='0000018230'),
    Asset('SPY', 'SPDR S&P 500 ETF Trust', 'etf', exchange='NYSE Arca'),
    Asset('QQQ', 'Invesco QQQ', 'etf', exchange='NASDAQ'),
    Asset('IWM', 'iShares Russell 2000 ETF', 'etf', exchange='NYSE Arca'),
    Asset('DIA', 'SPDR Dow Jones Industrial Average ETF Trust', 'etf', exchange='NYSE Arca'),
    Asset('TLT', 'iShares 20+ Year Treasury Bond ETF', 'etf', exchange='NASDAQ'),
    *[Asset(s, n, 'crypto', 'UTC', exchange='Crypto / USD') for s, n in [
        ('BTC-USD', 'Bitcoin / USD'), ('ETH-USD', 'Ethereum / USD'),
        ('SOL-USD', 'Solana / USD'), ('XRP-USD', 'XRP / USD'), ('ADA-USD', 'Cardano / USD'),
    ]],
    *[Asset(s, n, 'forex', 'America/New_York', 17, 'FX') for s, n in [
        ('EURUSD=X', 'EUR / USD'), ('GBPUSD=X', 'GBP / USD'), ('JPY=X', 'USD / JPY'),
        ('AUDUSD=X', 'AUD / USD'), ('CHF=X', 'USD / CHF'),
    ]],
    *[Asset(s, n, 'commodity', 'America/New_York', 18, 'CME / continuous futures') for s, n in [
        ('GC=F', 'Gold futures'), ('SI=F', 'Silver futures'), ('CL=F', 'Crude oil futures'),
        ('NG=F', 'Natural gas futures'), ('HG=F', 'Copper futures'),
    ]],
    Asset('^GSPC', 'S&P 500 Index', 'index', exchange='S&P DJI'),
    Asset('^NDX', 'Nasdaq-100 Index', 'index', exchange='NASDAQ'),
    Asset('^DJI', 'Dow Jones Industrial Average', 'index', exchange='S&P DJI'),
    Asset('^N225', 'Nikkei 225', 'index', 'Asia/Tokyo', exchange='Tokyo'),
    Asset('^GDAXI', 'DAX Index', 'index', 'Europe/Berlin', exchange='XETRA'),
]

BY_SYMBOL = {a.symbol: a for a in ASSETS}
