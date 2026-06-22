"""Shared auth guard for Laravel → python_engine internal task endpoints."""
from __future__ import annotations

import logging
import os

from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)


def client_is_loopback(request: Request) -> bool:
    client = request.client
    if client is None:
        return False
    host = (client.host or "").lower().strip("[]")
    return host in ("127.0.0.1", "::1", "localhost")


def verify_internal_trigger(request: Request) -> None:
    secret = (os.environ.get("ENGINE_INTERNAL_TRIGGER_SECRET") or "").strip()
    insecure = (os.environ.get("ENGINE_INTERNAL_TRIGGER_INSECURE_LOCAL") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    if secret:
        token = (request.headers.get("X-Engine-Trigger-Token") or "").strip()
        if token != secret:
            raise HTTPException(status_code=403, detail="Invalid trigger token")
        return
    if insecure and client_is_loopback(request):
        logger.warning(
            "internal trigger: no ENGINE_INTERNAL_TRIGGER_SECRET; allowing loopback only (insecure local)"
        )
        return
    raise HTTPException(
        status_code=503,
        detail="Set ENGINE_INTERNAL_TRIGGER_SECRET or ENGINE_INTERNAL_TRIGGER_INSECURE_LOCAL=1 (loopback only)",
    )
