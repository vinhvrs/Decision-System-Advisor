import logging
from pathlib import Path


def setup_engine_file_log() -> None:
    log_path = Path(__file__).resolve().parent.parent.parent / "storage" / "logs" / "engine.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setLevel(logging.INFO)
    fh.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(name)s - %(message)s"))
    root = logging.getLogger()
    target = str(log_path.resolve())
    if any(
        isinstance(h, logging.FileHandler) and getattr(h, "baseFilename", "") == target
        for h in root.handlers
    ):
        return
    root.addHandler(fh)
    root.setLevel(logging.INFO)
    # Per-request INFO lines from httpx clutter engine.log (Yahoo/GDELT polls).
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

