Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Starting Python FastAPI (WS) on http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "WS endpoint: ws://127.0.0.1:8000/ws/quotes" -ForegroundColor Cyan

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if (!(Test-Path ".venv")) {
  Write-Host "WARNING: .venv not found. Activate your venv manually if needed." -ForegroundColor Yellow
}

# If you have a venv at .venv, this will use it; otherwise falls back to python in PATH
$python = if (Test-Path ".venv\\Scripts\\python.exe") { ".venv\\Scripts\\python.exe" } else { "python" }

& $python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

