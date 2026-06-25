# DSA Local Setup Tutorial

Step-by-step guide to run **Decision System Advisor** on your machine: Next.js frontend, Laravel API, Python data engine, and supporting services (MySQL, Elasticsearch, Qdrant).

For architecture diagrams and thesis figures, see [`README.md`](README.md) and [`docs/`](docs/).

---

## What you will run

| Component | Role | Default URL |
|-----------|------|-------------|
| **Frontend** | Next.js UI (investing, screener, profiles, admin) | http://localhost:3000 |
| **Laravel API** | REST API behind nginx | http://localhost:1111/api |
| **Python engine** | Ingest, indicators, ranking, WebSocket quotes | http://localhost:8000 |
| **MySQL** | Primary database | `127.0.0.1:3307` (user `root`, password `root`, db `dsa`) |
| **Elasticsearch** | News / entity search | http://localhost:9200 |
| **Qdrant** | Vector store for RAG chunks | http://localhost:6333 |

---

## Prerequisites

Install these before you start:

| Tool | Version | Notes |
|------|---------|--------|
| **Git** | any recent | Clone the repository |
| **Docker Desktop** (or Docker Engine + Compose) | v2+ | Runs MySQL, API, Python, search stacks |
| **Node.js** | 20+ | Frontend dev server |
| **npm** | 10+ | Comes with Node |
| **PHP** | 8.4 | Only if you run `artisan` on the host |
| **Composer** | 2.x | Laravel dependencies (`backend/vendor`) |

**RAM:** allocate at least **8 GB** to Docker (Elasticsearch + Python model load are the heaviest consumers).

**Ports that must be free:** `3000`, `1111`, `8000`, `3307`, `9200`, `6333`.

---

## 1. Clone the repository

```bash
git clone https://github.com/<your-org>/Decision-System-Advisor.git
cd Decision-System-Advisor
```

---

## 2. Configure environment files

### Backend + Python (`backend/.env`)

The Python engine reads the same file as Laravel (mounted into the `data-engine` container).

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and check at least:

| Variable | Local Docker value | Purpose |
|----------|-------------------|---------|
| `DEV_MODE` | `dev` | Uses demo tables (`*_demo`, `snapshot_demo`) — recommended for committee/demo |
| `DB_HOST` | `db` | MySQL service name inside Docker Compose |
| `DB_PORT` | `3306` | Internal MySQL port (host maps `3307`) |
| `DB_DATABASE` | `dsa` | Database name |
| `DB_USERNAME` / `DB_PASSWORD` | `root` / `root` | Match `docker-compose.yml` |
| `APP_URL` | `http://localhost:1111` | Laravel base URL |
| `PYTHON_ENGINE_URL` | `http://data-engine:8000` | Laravel → Python (inside Compose network) |
| `ELASTIC_HOST` | `http://elasticsearch:9200` | Inside Compose |
| `QDRANT_URL` | `http://dsa-qdrant:6333` | Inside Compose |

**If you run PHP or Python on the host** (outside Docker) while MySQL stays in Docker:

- Set `DB_HOST=127.0.0.1` and `DB_PORT=3307`
- Set `DB_HOST_PYTHON=127.0.0.1` for Python on host
- Set `QDRANT_URL_PYTHON=http://127.0.0.1:6333`
- Keep `PYTHON_ENGINE_URL=http://127.0.0.1:8000` in Laravel when the engine is published on port 8000

### Frontend (`frontend/.env.local`)

```bash
cp frontend/.env.example frontend/.env.local
```

Important values:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:1111/api
NEXT_PUBLIC_CHAT_URL=http://127.0.0.1:8000/api/v1
NEXT_PUBLIC_SOCKET=ws://127.0.0.1:8000
DEV_MODE=dev
```

Use `127.0.0.1` (not only `localhost`) if you hit browser CORS issues with the API.

---

## 3. Start infrastructure and services

From the **repository root**:

```bash
docker compose up -d --build
```

Wait until containers are healthy:

```bash
docker compose ps
```

You should see `dsa-mysql`, `dsa-api`, `dsa-nginx`, `dsa-data-engine`, `dsa-elasticsearch`, and `dsa-qdrant` running.

**First build note:** the Python image installs PyTorch and dependencies; the first `docker compose build` can take 10–20 minutes.

---

## 4. Laravel setup (migrations & seed)

Install PHP dependencies and bootstrap Laravel. Choose **one** path:

### Option A — Run on the host (if PHP 8.4 + Composer are installed)

```bash
cd backend
composer install
php artisan key:generate
php artisan migrate
php artisan db:seed
cd ..
```

### Option B — Run inside the API container

```bash
docker exec -it dsa-api composer install
docker exec -it dsa-api php artisan key:generate
docker exec -it dsa-api php artisan migrate
docker exec -it dsa-api php artisan db:seed
```

The seeders load **stock entity aliases** and the **indicator catalog** — required for screener and indicator defaults.

---

## 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## 6. Verify services

Run these checks from a terminal:

```bash
# Laravel API
curl -s http://localhost:1111/api/rankings/dashboard-daily?lite=1 | head -c 200

# Python engine health / scheduler
curl -s http://localhost:8000/docs

# MySQL (optional)
docker exec dsa-mysql mysql -uroot -proot -e "SHOW TABLES FROM dsa;" | head
```

| Check | Expected |
|-------|----------|
| API responds | JSON (may be empty `rows` until data is loaded) |
| Python `/docs` | FastAPI Swagger UI HTML |
| Frontend | Home / investing page loads without network errors in the browser console |

---

## 7. Load market data (first time)

On a fresh database the **Ideal Investing Ranking** board and charts are empty until OHLC and snapshot tables are populated. The Python scheduler fills data automatically over time; you can speed it up:

### Automatic (recommended)

With `dsa-data-engine` running, background jobs start after boot:

- Stock candle sync (interval set in `docker-compose.yml`, default every 3 hours)
- Dashboard warm-up → Redis key `dashboard:daily` (ranking board)
- SEC fundamentals ingest for the fixed tech universe (when enabled)

Give the engine **2–5 minutes** after first start, then refresh http://localhost:3000/investing

### Manual warm-up (ranking board)

```bash
docker exec dsa-data-engine python3 -m app.warm_up.warm_up
```

### Manual demo OHLC backfill (30 days, demo tables)

```bash
docker compose run --rm data-engine python3 -m app.data_collect.collectors.stock_sync --days 30
```

### Admin UI (after you have an admin account)

1. Go to http://localhost:3000/admin/data-fill
2. Run jobs such as **demo board refill** or **market symbol** backfill
3. Watch progress at http://localhost:3000/admin/logs

---

## 8. `DEV_MODE` and database tables

`DEV_MODE` in `backend/.env` controls which MySQL tables Laravel and Python use:

| `DEV_MODE` | Tables used |
|------------|-------------|
| `dev` (default) | `instrument_data_demo`, `snapshot_demo`, `company_profile_demo`, … |
| `production` | `instrument_data`, `instrument_snapshot`, `company_profile`, … |

Keep `DEV_MODE=dev` for local committee demos unless you intentionally target production tables.

Frontend `DEV_MODE` / `NEXT_PUBLIC_DEV_MODE` should match for consistent symbol subsets in the UI.

---

## 9. Optional: Redis

Ranking cache and live dashboard payloads work best with **Redis**. `backend/.env.example` ships with cache/session on `database` so Redis is optional for a minimal boot.

To enable Redis locally:

1. Run Redis on the host (`brew install redis && redis-server`) or add a Redis service to Compose
2. Set in `backend/.env`:

```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
CACHE_STORE=redis
```

3. Restart `dsa-data-engine` so Python can write `dashboard:daily`

If Redis is misconfigured, the API falls back to database-built rankings (slower but functional).

---

## 10. Admin access

There is no default admin user in the seeders.

**Create a normal account:**

1. Open http://localhost:3000/auth/login → Register
2. With `MAIL_MAILER=log`, the OTP is written to Laravel logs:

```bash
docker exec dsa-api tail -f storage/logs/laravel.log
```

**Promote to admin** (one-time, local dev):

```bash
docker exec -it dsa-api php artisan tinker
```

```php
$user = \App\Models\User::where('email', 'you@example.com')->first();
$user->role = 'admin';
$user->save();
```

Then sign in at http://localhost:3000/admin

---

## 11. Key application URLs

| Page | URL |
|------|-----|
| Home / market view | http://localhost:3000 |
| Investing dashboard | http://localhost:3000/investing |
| Screener | http://localhost:3000/screener |
| Indicators & strategy | http://localhost:3000/indicators |
| SEC fundamentals hub | http://localhost:3000/fundamentals |
| Company profile | http://localhost:3000/companies/profile/aapl |
| Admin panel | http://localhost:3000/admin |
| API (example) | http://localhost:1111/api/rankings/beginner-board?limit=10 |
| Python API docs | http://localhost:8000/docs |

---

## 12. Daily development workflow

```bash
# Start stacks (if stopped)
docker compose up -d

# Frontend (separate terminal)
cd frontend && npm run dev

# After pulling new migrations
docker exec dsa-api php artisan migrate

# View Python logs
docker logs -f dsa-data-engine

# View Laravel logs
docker exec dsa-api tail -f storage/logs/laravel.log

# Stop everything
docker compose down
```

To reset the database volume (destructive):

```bash
docker compose down -v
docker compose up -d
# Re-run migrate + seed (section 4)
```

---

## 13. Troubleshooting

### Browser shows “Network Error” / Axios failed

- Confirm API is up: `curl http://localhost:1111/api/rankings/dashboard-daily?lite=1`
- Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local` → `http://127.0.0.1:1111/api`
- Ensure Laravel CORS allows your frontend origin (`backend/config/cors.php`)

### Empty ranking board

- Run warm-up: `docker exec dsa-data-engine python3 -m app.warm_up.warm_up`
- Confirm snapshot rows exist: admin → **Fill Data** → demo board jobs
- Check engine logs: `docker logs dsa-data-engine --tail 100`

### `composer install` / `vendor` missing in Docker

The API container mounts `./backend` but does not auto-install Composer deps. Run section 4 after every fresh clone.

### MySQL connection refused from host tools

Use port **3307**, not 3306:

```bash
mysql -h 127.0.0.1 -P 3307 -uroot -proot dsa
```

### Python engine exits or OOM

Increase Docker memory limit. Elasticsearch and sentence-transformers are memory-heavy.

### Registration OTP never arrives

With `MAIL_MAILER=log`, email is not sent — read OTP from `storage/logs/laravel.log`.

### Company logo missing in ranking (one symbol)

Ranking uses `logo_url` from the API; profiles fall back to Financial Modeling Prep image URLs. If a symbol shows only its initial, warm the dashboard after ensuring `company_profile_demo` has `image` values, or refresh the page (frontend applies the same FMP fallback as profiles).

---

## 14. Useful one-off commands

```bash
# Backfill news (GDELT) — requires NEWS_HANDLE_ENABLED=1 in backend/.env
docker compose run --rm -e NEWS_HANDLE_ENABLED=1 data-engine python3 news_ingest.py daily --lookback-days 14

# Build snapshot JSON tables
docker compose run --rm data-engine python3 snapshot_build.py

# Sync demo mirror (Yahoo → demo OHLC + snapshot JSON)
docker compose run --rm data-engine python3 -m app.data_collect.collectors.demo_data_sync

# SEC fundamentals for fixed symbols
docker compose run --rm data-engine python3 fundamental_ingest.py
```

---

## 15. Project layout (quick reference)

```
Decision-System-Advisor/
├── frontend/                 # Next.js app
├── backend/                  # Laravel API
│   ├── python_engine/        # FastAPI + jobs (also built as data-engine image)
│   └── .env                  # Shared with Python container
├── docker-compose.yml        # Local stack definition
├── README.md                 # Architecture index & figures
└── SETUP.md                  # This guide
```

---

## Next steps

- Read [`README.md`](README.md) for system architecture and ERD figures
- Explore [`docs/`](docs/) for use-case, sequence, and class diagrams
- Use **Admin → Fill Data** to backfill symbols before recording a demo video

If something in this guide does not match your checkout, prefer `docker-compose.yml` and `.env.example` files as the source of truth and open an issue with the step that failed.
