import os
import pymysql.cursors
from pathlib import Path
from dotenv import load_dotenv

# config/ → python_engine root
ENGINE_ROOT = Path(__file__).resolve().parent.parent
# python_engine/ → Laravel backend root (…/backend/.env)
BACKEND_ROOT = ENGINE_ROOT.parent

# Prefer Laravel ``backend/.env``; fall back to ``python_engine/.env`` if missing.
_env_backend = BACKEND_ROOT / ".env"
_env_engine = ENGINE_ROOT / ".env"

if _env_backend.is_file():
    load_dotenv(dotenv_path=_env_backend, override=True)
elif _env_engine.is_file():
    load_dotenv(dotenv_path=_env_engine, override=True)
else:
    raise FileNotFoundError(
        f"No .env found. Expected backend env at {_env_backend} "
        f"or python_engine env at {_env_engine}"
    )


def _e(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _e_int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    if raw is None or str(raw).strip() == "":
        return default
    return int(raw)


def _resolve_db_host() -> str:
    """
    Laravel in Docker often uses DB_HOST=host.docker.internal so PHP can reach MySQL on the machine.
    Native Python on Windows/macOS should use loopback when the DB port is published to the host.

    Override explicitly with DB_HOST_PYTHON in backend/.env (e.g. DB_HOST_PYTHON=127.0.0.1 or DB_HOST_PYTHON=db).
    Set DB_KEEP_DOCKER_INTERNAL=1 to force host.docker.internal from the host (rare).
    """
    explicit = _e("DB_HOST_PYTHON").strip()
    if explicit:
        return explicit
    raw = os.environ.get("DB_HOST", "").strip()
    if not raw:
        raise KeyError("DB_HOST")
    if raw.lower() != "host.docker.internal":
        return raw
    if _e("DB_KEEP_DOCKER_INTERNAL", "").lower() in ("1", "true", "yes"):
        return raw
    # Linux container runs typically have /.dockerenv; keep hostname for in-container pymysql.
    if Path("/.dockerenv").exists():
        return raw
    return "127.0.0.1"


def _resolve_redis_host() -> str:
    """
    Same idea as ``_resolve_db_host``: on the dev host, ``REDIS_HOST=host.docker.internal`` often
    points at nothing for Python, so reads/writes silently fail and ``dashboard:daily`` never fills.
    """
    explicit = _e("REDIS_HOST_PYTHON").strip()
    if explicit:
        return explicit
    raw = os.environ.get("REDIS_HOST", "127.0.0.1").strip()
    if not raw:
        return "127.0.0.1"
    if raw.lower() != "host.docker.internal":
        return raw
    if _e("REDIS_KEEP_DOCKER_INTERNAL", "").lower() in ("1", "true", "yes"):
        return raw
    if Path("/.dockerenv").exists():
        return raw
    return "127.0.0.1"


def _resolve_qdrant_url() -> str:
    """
    Engine in Docker should use the compose container name (http://dsa-qdrant:6333).
    Native Python on the host should use loopback via QDRANT_URL_PYTHON.
    """
    explicit = _e("QDRANT_URL_PYTHON").strip()
    if explicit:
        return explicit
    return _e("QDRANT_URL", "http://localhost:6333")


def _redis_should_use_ssl() -> bool:
    """
    Use TLS only when explicitly configured — same idea as Laravel ``REDIS_SCHEME`` default ``tcp``.

    Forcing ``ssl=True`` against a **non-TLS** Redis Cloud port causes
    ``[SSL] record layer failure`` (client speaks TLS, server speaks plain RESP).

    Enable TLS with ``REDIS_SSL=1``, ``REDIS_SCHEME=tls``, or ``REDIS_URL=rediss://...``.
    """
    flag = _e("REDIS_SSL", "").strip().lower()
    if flag in ("1", "true", "yes", "on"):
        return True
    if flag in ("0", "false", "no", "off"):
        return False
    scheme = _e("REDIS_SCHEME", "").strip().lower()
    if scheme in ("tls", "ssl", "rediss", "https"):
        return True
    u = _e("REDIS_URL", "").strip().lower()
    if u.startswith("rediss://"):
        return True
    return False


def _redis_ssl_verify() -> bool:
    return _e("REDIS_SSL_VERIFY", "1").strip().lower() not in ("0", "false", "no", "off")


class Settings:
    def __init__(self):
        # Laravel app vars — optional for collectors / CLI that only need DB & Redis
        self.APP_NAME = _e("APP_NAME", "DSA")
        self.APP_ENV = _e("APP_ENV", "local")
        self.APP_DEBUG = _e("APP_DEBUG", "false").lower() == "true"
        self.APP_PORT = _e_int("APP_PORT", 8000)
        self.TOP_N = _e_int("LIMIT", 300)

        # When true: ranking pool + OHLC for Python dashboard Redis payloads use
        # ``snapshot_demo`` / ``instrument_data_demo`` / ``instrument_period_demo``.
        self.DEV_MODE = _e("DEV_MODE", "dev").strip().lower()
        self.USE_DEMO_TABLES = self.DEV_MODE not in ("production", "prod")
        if _e("DASHBOARD_USE_DEMO", "").strip().lower() in ("1", "true", "yes", "on"):
            self.USE_DEMO_TABLES = True
        elif _e("DASHBOARD_USE_DEMO", "").strip().lower() in ("0", "false", "no", "off"):
            self.USE_DEMO_TABLES = False
        self.DASHBOARD_USE_DEMO = self.USE_DEMO_TABLES
        self.DEMO_SYNC_YF_PERIOD = _e("DEMO_SYNC_YF_PERIOD", "7d").strip() or "7d"
        # Yahoo → demo tables before each Redis warm-up (slow; can block hourly refresh). Off by default:
        # use scheduled ``stock_job`` / ``DSADemoSync`` for data freshness; warm-up only reads DB → Redis.
        self.DASHBOARD_WARMUP_RUN_DEMO_SYNC = _e("DASHBOARD_WARMUP_RUN_DEMO_SYNC", "").lower() in (
            "1",
            "true",
            "yes",
        )
        try:
            self.DASHBOARD_WARMUP_LOCK_WAIT_SEC = max(0, int(_e("DASHBOARD_WARMUP_LOCK_WAIT_SEC", "900")))
        except ValueError:
            self.DASHBOARD_WARMUP_LOCK_WAIT_SEC = 900
        # When true, ``run_dashboard_daily_warmup`` skips Redis SET if validation fails (legacy).
        self.DASHBOARD_REDIS_STRICT_VALIDATION = _e("DASHBOARD_REDIS_STRICT_VALIDATION", "").lower() in (
            "1",
            "true",
            "yes",
        )

        # Database (required for ingest / sync)
        try:
            self.DB_CONFIG = {
                "host": _resolve_db_host(),
                "port": int(os.environ["DB_PORT"]),
                "database": os.environ["DB_DATABASE"],
                "user": os.environ["DB_USERNAME"],
                "password": os.environ["DB_PASSWORD"],
                "cursorclass": pymysql.cursors.DictCursor,
            }
        except KeyError as e:
            print(f"Missing required DB .env key: {e}")
            exit(1)

        self.REDIS_HOST = _resolve_redis_host()
        self.REDIS_PORT = _e_int("REDIS_PORT", 6379)
        self.REDIS_PASSWORD = _e("REDIS_PASSWORD", "")
        un = _e("REDIS_USERNAME", "").strip()
        self.REDIS_USERNAME = un if un else None
        self.REDIS_DB = _e_int("REDIS_DB", 0)
        self.REDIS_PREFIX = _e("REDIS_PREFIX", "summary") or "summary"
        try:
            self.REDIS_SOCKET_TIMEOUT = float(_e("REDIS_SOCKET_TIMEOUT", "20"))
        except ValueError:
            self.REDIS_SOCKET_TIMEOUT = 20.0
        if self.REDIS_SOCKET_TIMEOUT <= 0:
            self.REDIS_SOCKET_TIMEOUT = 20.0

        self.REDIS_USE_SSL = _redis_should_use_ssl()
        self.REDIS_SSL_VERIFY = _redis_ssl_verify()

        self.ELASTIC_HOST = _e("ELASTIC_HOST", "http://localhost:9200")
        self.ELASTIC_INDEX = _e("ELASTIC_INDEX", "dsa_entities")

        self.QDRANT_URL = _resolve_qdrant_url()
        self.QDRANT_COLLECTION = _e("QDRANT_COLLECTION", "knowledge_chunks_v1")

        self.EMBEDDING_URL = _e("EMBEDDING_URL", "http://127.0.0.1:8000")

        self.ALPHA_VANTAGE_API_KEY = _e("ALPHA_VANTAGE_API_KEY")
        self.TWELVE_DATA_API_KEY = _e("TWELVE_DATA_API_KEY")
        self.FMP_API_KEY = _e("FMP_API_KEY")
        self.FINNHUB_API_KEY = _e("FINNHUB_API_KEY")
        self.GNEWS_API_KEY = _e("GNEWS_API_KEY")
        self.NEWSAPI_KEY = _e("NEWSAPI_KEY")
        self.MASSIVE_API_KEY = _e("MASSIVE_API_KEY")
        self.NEWSAPIORG_KEY = _e("NEWSAPIORG_KEY")
        self.NEWSDATA_KEY = _e("NEWSDATA_API_KEY")

    def redis_client(self):
        """
        Match Laravel Redis config (incl. ``REDIS_USERNAME`` for Redis Cloud / ACL, TLS when required).
        Prefer ``REDIS_URL`` (e.g. ``rediss://...``) when set — same as Laravel.
        """
        import ssl

        import redis as redis_lib

        url = _e("REDIS_URL", "").strip()
        if url:
            return redis_lib.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=self.REDIS_SOCKET_TIMEOUT,
                socket_timeout=self.REDIS_SOCKET_TIMEOUT,
            )

        pw = self.REDIS_PASSWORD
        if pw is None or str(pw).strip() == "":
            pw = None
        kwargs = {
            "host": self.REDIS_HOST,
            "port": self.REDIS_PORT,
            "db": self.REDIS_DB,
            "password": pw,
            "decode_responses": True,
            "socket_connect_timeout": self.REDIS_SOCKET_TIMEOUT,
            "socket_timeout": self.REDIS_SOCKET_TIMEOUT,
        }
        if self.REDIS_USERNAME:
            kwargs["username"] = self.REDIS_USERNAME
        if self.REDIS_USE_SSL:
            kwargs["ssl"] = True
            if not self.REDIS_SSL_VERIFY:
                kwargs["ssl_cert_reqs"] = ssl.CERT_NONE
        return redis_lib.Redis(**kwargs)


Config = Settings()
settings = Config
