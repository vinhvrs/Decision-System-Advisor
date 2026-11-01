# Local macOS verification checklist

Use branch: `fix/local-mac-stabilization`.

## Clean start

```bash
git fetch origin
git checkout fix/local-mac-stabilization
git pull

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

docker compose --env-file backend/.env down -v
docker compose --env-file backend/.env up -d --build
```

Then initialize Laravel:

```bash
docker compose --env-file backend/.env exec app php artisan key:generate
docker compose --env-file backend/.env exec app php artisan migrate
```

The frontend is started by Docker Compose automatically.

## Expected endpoints

- Frontend: http://localhost:3000
- Laravel/Nginx: http://localhost:1111
- Data engine: http://localhost:8000
- Elasticsearch: http://localhost:9200
- Qdrant: http://localhost:6333/healthz
- MySQL: 127.0.0.1:3307
- Redis: 127.0.0.1:6379

## Smoke tests

```bash
docker compose --env-file backend/.env ps
curl -i http://localhost:1111
curl -i http://localhost:8000
curl -i http://localhost:9200
curl -i http://localhost:6333/healthz
redis-cli -h 127.0.0.1 -p 6379 ping
```

## App checks

1. Landing page renders without console exceptions.
2. Login/register requests reach the Laravel API.
3. Authenticated API calls send the `Authorization: Bearer ...` header.
4. Instrument list loads.
5. Market dashboard loads without endless skeleton state.
6. A chart can load at least one symbol/timeframe.
7. Chat/advisor accepts a ticker and returns a structured response.
8. Redis contains analysis/dashboard keys after a data-engine run.
9. No service restarts repeatedly in `docker compose ps`.

## Logs to capture when something fails

```bash
docker compose --env-file backend/.env logs --tail=300 frontend app nginx
docker compose --env-file backend/.env logs --tail=300 data-engine
docker compose --env-file backend/.env logs --tail=300 db redis elasticsearch qdrant
```

Do not move fixes to `pi4-server` until this checklist passes on macOS.
