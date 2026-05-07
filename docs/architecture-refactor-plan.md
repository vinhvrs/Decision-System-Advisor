# Architecture Refactor Plan

This repository is a monorepo with three runtimes:

- `frontend` (Next.js)
- `backend` (Laravel plugin-based API)
- `backend/python_engine` (data pipelines + scheduler API)

## Canonical Conventions

- Use `analysis` as the domain term (avoid `analysist` in new code).
- Use `yearly` as period key in API payloads.
- Use `annual` only for table names when it is already part of the schema (`snapshot_annual`).
- Prefer one canonical endpoint path and keep aliases only for backward compatibility windows.

## Completed Safe Refactors

- Normalized Python snapshot updater module path:
  - New canonical module: `backend/python_engine/app/storage/snapshot_update.py`
  - Legacy compatibility shim retained at:
    `backend/python_engine/app/storage/storage/snapshot_update.py`
- Updated import in scheduler entrypoint to canonical path:
  - `backend/python_engine/app/main.py`
- Cleaned route files to reduce dead/commented code noise:
  - `backend/platform/plugins/trading/src/Routes/InstrumentRoute.php`
  - `backend/platform/plugins/trading/src/Routes/StockRoute.php`
- Added canonical `Analysis*` aliases while preserving legacy `Analysist*` names:
  - `backend/platform/plugins/trading/src/Services/AnalysisService.php`
  - `backend/platform/plugins/trading/src/Http/Controllers/AnalysisController.php`
  - `backend/platform/plugins/trading/src/Routes/AnalysisRoute.php`
  - `backend/routes/load_plugins.php` now loads canonical + legacy route files
- Added frontend service alias entrypoints for naming migration:
  - `frontend/src/services/instrumentService.ts`
  - `frontend/src/services/newsService.ts`
- Extracted bootstrap concerns from Python `main.py`:
  - `backend/python_engine/app/bootstrap/scheduler_config.py`
  - `backend/python_engine/app/bootstrap/logging_setup.py`
  - `backend/python_engine/app/bootstrap/__init__.py`
- Extracted scheduler runtime and lifespan wiring:
  - `backend/python_engine/app/bootstrap/scheduler_runtime.py`
  - `backend/python_engine/app/main.py` is now thin entry (app init + routes)
- Split scheduler jobs into focused modules:
  - `backend/python_engine/app/jobs/ranking_job.py`
  - `backend/python_engine/app/jobs/dashboard_job.py`
  - `backend/python_engine/app/jobs/news_job.py`
  - `backend/python_engine/app/jobs/stock_job.py`
  - `backend/python_engine/app/jobs/analysis_job.py`
  - `backend/python_engine/app/jobs/__init__.py`
- Began Laravel service/controller boundary cleanup (non-breaking):
  - `AnalysistService` now exposes pure-data methods (`indicator*Data`)
  - `AnalysistController` now returns HTTP responses explicitly
  - legacy `Indicator_*` service methods remain as compatibility wrappers

## Next Refactor Steps (Non-Breaking Sequence)

1. Move service-layer HTTP responses to controllers in trading plugin.
2. Continue splitting Python runtime into:
   - `app/bootstrap/api.py` (optional app factory, if needed)
   - finer-grained job helpers (optional) only when job complexity grows
3. Standardize frontend service export style (`object` or `class`) and filename style.

## Breaking Changes Policy

- Do not delete compatibility aliases in the same release.
- Mark deprecated routes/classes and remove only after clients migrate.
- Keep database period constants stable across Laravel/Python/Frontend.

