import os
import pymysql.cursors
from pathlib import Path
from dotenv import load_dotenv

env_path = Path('..') / '.env'
if not env_path.exists():
    raise FileNotFoundError("❌ File .env không tồn tại. Vui lòng kiểm tra lại đường dẫn.")

load_dotenv(dotenv_path=env_path)

class Config:
    try:
        # Database
        DB_CONFIG = {
            "host": os.environ["DB_HOST"],
            "user": os.environ["DB_USERNAME"],
            "password": os.environ["DB_PASSWORD"],
            "database": os.environ["DB_DATABASE"],
            "port": int(os.environ.get("DB_PORT", 3306)),
            "cursorclass": pymysql.cursors.DictCursor # Ép trả về Dictionary
        }

        # Redis - Ép kiểu INT cho Port và DB
        REDIS_HOST = os.environ["REDIS_HOST"]
        REDIS_PORT = int(os.environ["REDIS_PORT"])
        REDIS_DB = int(os.environ.get("REDIS_DB", 0)) # Bắt buộc là số
        REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
        REDIS_PREFIX = os.getenv("REDIS_PREFIX", "summary") # Prefix cho Redis keys

        TOP_N = int(os.environ.get("TOP_N", 10))
    except Exception as e:
        print(f"❌ Lỗi cấu hình .env: {e}")
        exit(1)