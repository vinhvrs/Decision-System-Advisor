# Database ERD (PlantUML, two figures)

Crow’s-foot style **logical** ERDs derived from `backend/database/migrations`. Only **declared foreign keys** are drawn as solid relationships unless noted. Framework-only tables (`jobs`, `job_batches`, `failed_jobs`, `cache`, `cache_locks`, `password_reset_tokens`, `personal_access_tokens`) are omitted to keep thesis figures readable.

**Source files**

- [`plantuml/erd-user-domain.puml`](./plantuml/erd-user-domain.puml) — **Figure 1:** `users` and related billing, tickets, watchlist, logs, email.
- [`plantuml/erd-instruments-domain.puml`](./plantuml/erd-instruments-domain.puml) — **Figure 2:** `instruments`, OHLC pipeline, profiles, RAG chunks, NLP entities, crawler state.

**Render**

1. [PlantUML Web Server](https://www.plantuml.com/plantuml/uml/) — paste file contents.
2. **VS Code / Cursor:** [PlantUML extension](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml) (+ Graphviz if required).
3. **CLI:** `java -jar plantuml.jar docs/plantuml/erd-user-domain.puml` → PNG/SVG next to the file.

Dotted arrows (e.g. `payment` → `payment_status`, `instruments` → `instrument_snapshot`) mark **intended** links **without** a `foreign()` in migrations.

---

## Figure 1 — Users, billing, trading activity, admin mail & logs

Centred on **`users`**: public profile slug (`users_slug`), **sessions**, chat **history**, **bills** / **payment** / **payment_status**, simulated positions (**tickets**), **watchlist**, **admin_activity_logs**, and **email_messages** (two optional FKs to `users`).

**Notes (Figure 1)**

- **`payment_status.payment_id` → `payment.id`:** shown as a **dotted** relationship; add a migration with `foreign()` for DB-level integrity.
- **`email_messages`:** `admin_user_id` and `client_user_id` both reference `users.id` (nullable).
- **`personal_access_tokens`:** Sanctum polymorphic token — omitted.

---

## Figure 2 — Instruments, OHLC pipeline, fundamentals, knowledge (RAG), crawl & NLP entities

Centred on **`instruments`**: **instrument_periods** → **instrument_data**; **company_profile** and **stock_attributes**; **instrument_snapshot** (logical 1:0..1); **indicators** (standalone catalogue); **knowledge_docs** → **knowledge_chunks**; **knowledge** (JSON `source_docs_ids`, not an FK); **stock_entities** → **stock_entity_aliases**; **crawler_states** (no FK to `instruments`).

**Notes (Figure 2)**

- **`instrument_snapshot.instrument_id`:** dotted link to **`instruments`**; migration does not declare `foreign()`.
- **`company_profile`:** no surrogate PK in migration — only `instrument_id` + FK to `instruments`.
- **`knowledge.source_docs_ids`:** JSON list of document UUIDs — not a relational FK.
- **`indicators`:** no `strategy_indicators` (or similar) join table in current migrations.
- **`crawler_states`:** keyed by `(source, symbol)` in the app, not by `instruments.id`.

---

## See also

[`architecture-diagrams.md`](./architecture-diagrams.md) · [`class-diagrams.md`](./class-diagrams.md)
