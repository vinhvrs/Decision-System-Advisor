import os
import pymysql.cursors
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
env_path = BASE_DIR / '.env'
if not env_path.exists():
    raise FileNotFoundError(f"❌ File .env không tồn tại tại: {env_path.absolute()}")

load_dotenv(dotenv_path=env_path)

class Settings:
    def __init__(self):
        try:
            # --- APP ---
            self.APP_NAME = os.environ["APP_NAME"]
            self.APP_ENV = os.environ["APP_ENV"]
            self.APP_DEBUG = os.environ["APP_DEBUG"].lower() == 'true'
            self.APP_PORT = int(os.environ["APP_PORT"])
            self.TOP_N = int(os.environ["LIMIT"]) if os.environ.get("LIMIT") else 300

            # --- DATABASE (MySQL) ---
            self.DB_CONFIG = {
                "host": os.environ["DB_HOST"],
                "port": int(os.environ["DB_PORT"]),
                "database": os.environ["DB_DATABASE"],
                "user": os.environ["DB_USERNAME"],
                "password": os.environ["DB_PASSWORD"],
                "cursorclass": pymysql.cursors.DictCursor
            }

            # --- REDIS ---
            self.REDIS_HOST = os.environ["REDIS_HOST"]
            self.REDIS_PORT = int(os.environ["REDIS_PORT"])
            self.REDIS_PASSWORD = os.environ["REDIS_PASSWORD"]
            self.REDIS_DB = int(os.environ["REDIS_DB"])
            self.REDIS_PREFIX = 'summary' 
            
            # --- ELASTICSEARCH ---
            self.ELASTIC_HOST = os.environ["ELASTIC_HOST"]
            self.ELASTIC_INDEX = os.environ["ELASTIC_INDEX"]

            # --- QDRANT ---
            self.QDRANT_URL = os.environ["QDRANT_URL"]
            self.QDRANT_COLLECTION = os.environ["QDRANT_COLLECTION"]

            # --- EMBEDDING ---
            self.EMBEDDING_URL = os.environ["EMBEDDING_URL"]

            # --- EXTERNAL API KEYS ---
            self.ALPHA_VANTAGE_API_KEY = os.environ["ALPHA_VANTAGE_API_KEY"]
            self.TWELVE_DATA_API_KEY = os.environ["TWELVE_DATA_API_KEY"]
            self.FMP_API_KEY = os.environ["FMP_API_KEY"]
            self.FINNHUB_API_KEY = os.environ["FINNHUB_API_KEY"]
            self.GNEWS_API_KEY = os.environ["GNEWS_API_KEY"]
            self.NEWSAPI_KEY = os.environ["NEWSAPI_KEY"]
            self.MASSIVE_API_KEY = os.environ["MASSIVE_API_KEY"]
            self.NEWSAPIORG_KEY = os.environ["NEWSAPIORG_KEY"]
            self.NEWSDATA_KEY = os.environ["NEWSDATA_API_KEY"]

        except KeyError as e:
            print(f"❌ Lỗi: Thiếu tham số bắt buộc {e} trong file .env")
            exit(1)
        except ValueError as e:
            print(f"❌ Lỗi: Sai kiểu dữ liệu (ép kiểu INT thất bại): {e}")
            exit(1)

# Khởi tạo instance
Config = Settings()
settings = Config
