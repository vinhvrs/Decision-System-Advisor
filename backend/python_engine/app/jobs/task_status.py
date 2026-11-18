"""In-process job status for /admin/data health."""
from contextlib import contextmanager
from datetime import datetime, timezone
import threading

lock = threading.Lock()
last_run = {}

  
def _utcnow():
    return datetime.now(timezone.utc).isoformat()

@contextmanager
def tracked(name):
    started = _utcnow()
    with lock:
        last_run[name] = {"status": "running", "started_at": started}
    try:
        yield
    except Exception as e:
        with lock:
            last_run[name] = {"status": "error", "started_at": started, "finished_at": _utcnow(), "error": str(e)[:1000]}
        raise
    else:
        with lock:
            last_run[name] = {"status": "ok", "started_at": started, "finished_at": _utcnow()}
