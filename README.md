# Decision System Advisor

Source repository for the **Decision System Advisor (DSA)** — a web-based investment advisory system. The stack comprises a **Next.js** client, a **Laravel** REST API, and a **Python** analysis engine. Shared persistence uses **MySQL**; **Redis** and **Elasticsearch** support caching and search. Schema definitions live in `backend/database/migrations`.

This README is an index for thesis reviewers. Detailed figures and prose are under [`docs/`](docs/).

---

## Repository layout

| Path | Contents |
|------|----------|
| [`frontend/`](frontend/) | Next.js application (App Router, charts, admin UI) |
| [`backend/`](backend/) | Laravel API, plugins (`trading`, `advisor`, `users`), migrations |
| [`backend/python_engine/`](backend/python_engine/) | FastAPI services, ingest jobs, indicators, ranking, fundamentals |
| [`docs/`](docs/) | UML figures, ERD, architecture diagrams (thesis sources) |
| [`docker-compose.yml`](docker-compose.yml) | MySQL, Elasticsearch, Qdrant, Redis (local infrastructure) |

---

## Documentation index

| Topic | Document | Thesis role |
|-------|----------|-------------|
| **Chen ERD (conceptual)** | [`docs/erd-overview.md`](docs/erd-overview.md) | Figure 3.2 — entities, attributes, relationships |
| **Physical schema (tables)** | [`docs/database-schema-diagrams.md`](docs/database-schema-diagrams.md) | Figure 3.3 — columns, PK/FK, types |
| **Database index** | [`docs/database-erd.md`](docs/database-erd.md) | Quick links to ERD and schema files |
| **System architecture** | [`docs/architecture-diagrams.md`](docs/architecture-diagrams.md) | Layered view: client, Laravel, Python, stores |
| **Use cases** | [`docs/use-case-diagrams.md`](docs/use-case-diagrams.md) | End-user and admin use-case diagrams (PlantUML) |
| **Class diagrams** | [`docs/class-diagrams.md`](docs/class-diagrams.md) | Laravel, Python, and frontend layers |
| **Sequence diagrams** | [`docs/sequence-diagrams.md`](docs/sequence-diagrams.md) | Ranking and trading request flows |

Rendered SVG exports are in [`docs/svg/`](docs/svg/). Editable sources: [`docs/plantuml/`](docs/plantuml/), [`docs/mermaid/`](docs/mermaid/).

---

## Database design (two diagram types)

The thesis uses two complementary views of the same schema:

1. **Chen ERD** — conceptual model (rectangle = entity, oval = attribute, hexagon = relationship). Overview and per-domain figures: `docs/plantuml/chen-*.puml` → `docs/svg/chen-*.svg`. See [`docs/erd-overview.md`](docs/erd-overview.md).

2. **Physical schema** — crow's-foot table diagrams with column types and constraints. Domain files: `database-schema-users.puml`, `database-schema-instruments.puml`, `database-schema-knowledges.puml`. See [`docs/database-schema-diagrams.md`](docs/database-schema-diagrams.md).

**Domains**

| Domain | Chen ERD (3.2) | Tables (3.3) |
|--------|----------------|--------------|
| Identity & access | `chen-identity-access` | Users hub (`users`, `sessions`, `users_slug`, …) |
| Trading & advisory | `chen-trading-activity` | `history`, `tickets`, `watchlist` |
| Admin & mail | `chen-admin-mail` | `admin_activity_logs`, `email_messages` |
| Knowledge & crawler | `chen-knowledge-crawler` | `knowledge_docs`, `crawler_states` |
| Instruments & OHLC | `chen-instruments-domain` | `instruments`, periods, OHLC, snapshots, fundamentals |

Cross-domain links (e.g. `symbol` between tickets, watchlist, knowledge, and instruments) are logical associations, not always enforced as foreign keys in migrations.

**Source of truth:** `backend/database/migrations/`

---

## Reproducing figures

**PlantUML** (Chen ERD, use cases, physical schema) — requires Java and Graphviz:

```bash
export PATH="/opt/homebrew/bin:$PATH"
export PLANTUML_LIMIT_SIZE=16384   # needed for the combined Chen overview

java -jar plantuml.jar -tsvg docs/plantuml/chen-*.puml
java -jar plantuml.jar -tsvg docs/plantuml/database-schema-*.puml
java -jar plantuml.jar -tsvg docs/plantuml/use-case-*.puml
```

For `chen-database-overview`, move the output to `docs/svg/chen-database-overview.svg` (PlantUML names the file from the `@startuml` block id).

**Mermaid** (architecture, class, sequence) — paste blocks from the `.md` files into [mermaid.live](https://mermaid.live), or use the CLI:

```bash
npx @mermaid-js/mermaid-cli -i docs/mermaid/erd-users-domain.mmd -o docs/svg/erd-users-domain.svg -b transparent
```

---

## Running the system (brief)

Infrastructure:

```bash
docker compose up -d
```

Backend (from `backend/`): configure `.env`, run `composer install`, `php artisan migrate`.

Frontend (from `frontend/`): `npm install`, `npm run dev`.

Python engine (from `backend/python_engine/`): see `requirements.txt` and `run_local.ps1` / `run_local.bat`.

Exact environment variables and ports depend on local `.env` files and are not duplicated here.

---

## Figure file map

```
docs/
├── erd-overview.md              # Chen ERD — thesis overview (Fig. 3.2)
├── database-schema-diagrams.md  # Physical tables (Fig. 3.3)
├── architecture-diagrams.md
├── use-case-diagrams.md
├── class-diagrams.md
├── sequence-diagrams.md
├── plantuml/                    # .puml sources
├── mermaid/                     # .mmd sources
└── svg/                         # Rendered exports for Word/PDF
```
