# Decision System Advisor (DSA)

Decision System Advisor is a full-stack market analysis and decision-support project.

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Lightweight Charts
- **API:** Laravel 12 / PHP 8
- **Data engine:** Python 3.11, FastAPI, pandas, yfinance
- **Data:** MySQL, Redis
- **Search / AI:** Elasticsearch, Qdrant, Sentence Transformers
- **Local runtime:** Docker Compose

## Local development on macOS

The branch `fix/local-mac-stabilization` is the local-Mac stabilization branch based on the newest project snapshot (`05/05/2026`).

### Requirements

- Docker Desktop
- Git

No host installation of PHP, Composer, Python, Node.js or npm is required.
Apple Silicon and Intel Macs are both supported by the Docker setup.

### 1. Configure environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Keep real API keys only in `backend/.env`. Do not commit them.

### 2. Build and start the complete Docker stack

Use the backend env file for Compose interpolation so database credentials stay consistent:

```bash
docker compose --env-file backend/.env up -d --build
```

Services:

- Next.js frontend: http://localhost:3000
- Laravel/Nginx API: http://localhost:1111
- Python data engine: http://localhost:8000
- MySQL host port: 3307
- Redis: 6379
- Elasticsearch: 9200
- Qdrant: 6333

All development ports are bound to `127.0.0.1` only.

### 3. Generate Laravel key and migrate

```bash
docker compose --env-file backend/.env exec app php artisan key:generate
docker compose --env-file backend/.env exec app php artisan migrate
```

If the project needs seed/demo data:

```bash
docker compose --env-file backend/.env exec app php artisan db:seed
```

### 4. Open the frontend

The frontend is already running in Docker:

```text
http://localhost:3000
```

For live logs:

```bash
docker compose --env-file backend/.env logs -f frontend
```

### Useful checks

```bash
docker compose --env-file backend/.env ps
docker compose --env-file backend/.env logs -f frontend app nginx data-engine
curl http://localhost:1111
curl http://localhost:8000
curl http://localhost:9200
curl http://localhost:6333/healthz
```

### Reset local containers and data

```bash
docker compose --env-file backend/.env down -v
```

## Security notes

- API keys are read from environment variables.
- The Finnhub import endpoint no longer contains a hard-coded token.
- Sensitive `.env` files and the hard-coded Finnhub token were scrubbed from reachable branch/tag history with `git filter-repo`. Any credential that was ever public must still be rotated/revoked at its provider.
- Do not commit `.env` files.

## Branch strategy

1. Stabilize and test this branch on macOS.
2. Fix functional issues found during local testing here.
3. Only after local verification, port the validated changes to `pi4-server` and apply Raspberry Pi-specific memory/ARM optimizations.

The Pi branch is intentionally not modified during the local stabilization phase.
