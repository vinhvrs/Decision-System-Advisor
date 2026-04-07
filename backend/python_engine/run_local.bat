@echo off
setlocal

echo Starting Python FastAPI (WS) on http://127.0.0.1:8000
echo WS endpoint: ws://127.0.0.1:8000/ws/quotes

cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
) else (
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
)

endlocal

