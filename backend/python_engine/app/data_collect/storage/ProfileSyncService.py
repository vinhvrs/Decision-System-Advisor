import os
import sys
import pymysql
import yfinance as yf
import requests
import time
from datetime import datetime

# Project settings (DB, etc.)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from config.settings import settings

class ProfileSyncService:
    def __init__(self):
        self.db_config = settings.DB_CONFIG.copy()
        self.db_config['cursorclass'] = pymysql.cursors.DictCursor
        # Finnhub key from environment
        self.FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY")

    def get_finnhub_logo(self, symbol):
        if not self.FINNHUB_API_KEY:
            return None
        try:
            url = f"https://finnhub.io/api/v1/stock/profile2?symbol={symbol}&token={self.FINNHUB_API_KEY}"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                return response.json().get('logo')
        except:
            pass
        return None

    def sync_missing_profiles(self):
        conn = pymysql.connect(**self.db_config)
        conn.autocommit(True)
        try:
            with conn.cursor() as cur:
                # Rows missing profile fields or logo
                sql = """
                SELECT s.symbol, s.instrument_id, p.image 
                FROM instrument_snapshot s
                LEFT JOIN company_profile p ON s.symbol = p.symbol
                WHERE p.symbol IS NULL 
                   OR p.industry IS NULL OR p.industry = ''
                   OR p.image IS NULL OR p.image = '';
                """
                cur.execute(sql)
                targets = cur.fetchall()
                print(f"[profile-sync] {len(targets)} symbol(s) to process.")

                for target in targets:
                    symbol = target['symbol']
                    inst_id = target['instrument_id']
                    current_image = target.get('image')
                    
                    print(f"[profile-sync] Processing {symbol}...")

                    # 1) yfinance profile
                    info = {}
                    try:
                        ticker = yf.Ticker(symbol)
                        info = ticker.info
                    except:
                        pass

                    # 2) Finnhub logo if image empty
                    logo_url = current_image
                    if not current_image or current_image == '':
                        logo_url = self.get_finnhub_logo(symbol)

                    # 3) Map fields (exchange required for NOT NULL / strict mode)
                    name = info.get('longName') or symbol
                    industry = info.get('industry')
                    sector = info.get('sector')
                    exchange = info.get('exchange', 'UNKNOWN')
                    website = info.get('website')
                    desc = info.get('longBusinessSummary')
                    country = info.get('country')
                    
                    ceo = ""
                    officers = info.get('companyOfficers', [])
                    if officers:
                        ceo = officers[0].get('name', '')

                    # 4) Upsert company_profile
                    sql_upsert = """
                    INSERT INTO company_profile 
                        (instrument_id, symbol, company_name, exchange, industry, sector, website, description, ceo, country, image, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON DUPLICATE KEY UPDATE 
                        company_name = VALUES(company_name),
                        exchange = IF(exchange IS NULL OR exchange = '' OR exchange = 'UNKNOWN', VALUES(exchange), exchange),
                        industry = IFNULL(industry, VALUES(industry)),
                        sector = IFNULL(sector, VALUES(sector)),
                        image = IF(image IS NULL OR image = '', VALUES(image), image),
                        updated_at = NOW();
                    """
                    
                    cur.execute(sql_upsert, (
                        inst_id, symbol, name, exchange, industry, sector, 
                        website, desc, ceo, country, logo_url
                    ))
                    
                    print(f"[profile-sync] Done {symbol} (exchange={exchange})")
                    time.sleep(1.2)  # throttle external APIs

        finally:
            conn.close()

if __name__ == "__main__":
    ProfileSyncService().sync_missing_profiles()