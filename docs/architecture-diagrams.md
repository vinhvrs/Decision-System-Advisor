# DSA architecture diagrams (simple layered view)

Mermaid sources for thesis figures. **Chatbot / assistant** paths are omitted; they may still exist in code.

Render in VS Code (Mermaid preview) or [mermaid.live](https://mermaid.live).

**Below:** one **system overview**, then per-tier breakdowns (Laravel, Python, frontend).

---

## System overview

Placement of **Next.js**, **Laravel**, and the **Python** engine, and how each talks to **MySQL**, **Redis**, and **Elasticsearch**. Laravel and Python coordinate mainly through **shared stores** and aligned indices, not only through direct HTTP. Vector search (where used) is treated as an implementation detail of the Python analysis path and is **not** shown as its own store here.

```mermaid
flowchart TB
  subgraph client["Client tier"]
    BR[Browser]
    subgraph next["Next.js"]
      PG[App Router · layouts & pages · site / auth / admin]
      CMP[Components · charts · tables · forms]
      HK[Hooks & client state]
      SVM["src/services · Auth · Admin · Instruments · News · …"]
      HC[libs/api · HTTP client · cookies / tokens]
    end
  end

  subgraph laravel["Laravel backend"]
    RT[Routes · bootstrap · api · web · admin · elastic]
    PL[Plugin routes · trading · advisor hooks]
    MW[Middleware · Sanctum · throttle · admin / staff]
    CT[Controllers · trading · admin · elastic proxy]
    SV[Services · domain logic · sync · mail]
    RP[Repositories]
    EM[Eloquent models]
  end

  subgraph python["Python engine"]
    FP[FastAPI · REST · scheduled lifespan]
    IG[Ingest · RSS / corporate / OHLC & storage jobs]
    ID[Indicators · OHLCV prep · technical features]
    AN[Analysis · rules · composer · ES-assisted retrieval]
    WS[WebSocket · live market / instrument stream]
    OUT[Writes · SQL rows · Redis cache & rankings]
  end

  subgraph stores["Shared stores"]
    MY[(MySQL)]
    RS[(Redis)]
    SE[Elasticsearch]
  end

  BR --> PG --> CMP --> HK --> SVM --> HC
  HC -->|HTTPS JSON| RT
  RT --> PL --> MW --> CT
  CT --> SV
  CT --> RP
  SV --> RP --> EM --> MY
  SV --> RS
  SV --> SE
  CT --> SE

  FP --> IG
  FP --> ID
  FP --> AN
  FP --> WS
  IG --> MY
  IG --> ID
  ID --> AN
  AN --> OUT
  AN --> SE
  OUT --> MY
  OUT --> RS
```

---

## 1. PHP backend (Laravel)

```mermaid
flowchart TB
  subgraph routes["routes"]
    R1[bootstrap/app.php · withRouting]
    R2[Core routes · api · web · admin · elastic]
    R3[Plugin routes · platform/plugins · trading …]
  end

  subgraph mw["middleware"]
    M1[Global API · e.g. cookie token]
    M2[Aliases · auth · admin.staff · activity log …]
    M3[Route middleware · sanctum · throttle]
  end

  subgraph http["controllers"]
    C1[Trading plugin · auth · companies · instruments · news · rankings …]
    C2[App · Admin CRUD · ElasticController · …]
  end

  subgraph app["application"]
    S1[Services · Company · News · Snapshot · Email · Elastic\* …]
    REP[Repositories · interfaces + Eloquent impl]
  end

  subgraph orm["persistence"]
    E[Eloquent models]
    DB[("MySQL")]
  end

  subgraph ext["integrations"]
    REDIS[("Redis · cache / queues")]
    ES[Elasticsearch client / indices]
  end

  R1 --> R2 --> R3
  R3 --> M1 --> M2 --> M3
  M3 --> C1
  M3 --> C2
  C1 --> S1
  C2 --> S1
  C1 --> REP
  C2 --> REP
  S1 --> REP
  REP --> E
  E --> DB
  S1 --> REDIS
  S1 --> ES
  C2 --> ES
```

---

## 2. Python engine

```mermaid
flowchart TB
  subgraph collect["ingest"]
    NC[News pipelines · RSS · scheduled windows]
    MK[Market / symbol sync · OHLC · corporate actions]
    ST[storage helpers · DB format · cleanup / swap]
  end

  subgraph prep["preprocess & indicators"]
    PRE[Normalize OHLCV DataFrames]
    IND[pandas_ta · RSI · MACD · EMA · Bollinger …]
  end

  subgraph analyze["analysis & composition"]
    AA[Auto-analyze & advice payload assembly]
    RL[rules / composer · scoring & phrasing]
    ESX[Elasticsearch retriever · merged context]
  end

  subgraph out["output & delivery"]
    W[SQL writes · snapshots · knowledge rows]
    RC[Redis · analysis cache · heatmap / ranking keys]
    WS[WebSocket · ConnectionManager · market stream]
  end

  subgraph api["API shell"]
    FA[FastAPI main · REST · lifespan / schedulers]
  end

  DB[("MySQL")]
  RD[("Redis")]
  SE[Elasticsearch]

  FA --> NC
  FA --> MK
  FA --> ST
  FA --> AA
  FA --> WS
  NC --> DB
  MK --> DB
  ST --> DB
  NC --> PRE
  MK --> PRE
  PRE --> IND
  IND --> AA
  AA --> ESX
  ESX --> SE
  AA --> RL
  AA --> W
  AA --> RC
  RL --> W
  W --> DB
  RC --> RD
```

---

## 3. Frontend (Next.js)

```mermaid
flowchart TB
  subgraph view["view"]
    PG["app/ · route groups · site · auth · admin"]
    V["page.tsx · layouts · shared UI"]
    CMP["components/ · charts · header · dashboard …"]
  end

  subgraph logic["presentation logic"]
    L["useState / effects · custom hooks · form handlers"]
  end

  subgraph svc["services"]
    A["Auth · Admin · Company · Instrument · News · Heatmap …"]
  end

  subgraph io["client IO"]
    API["libs/api.ts · base URL · cookies"]
  end

  subgraph remote["remote"]
    BE["Laravel REST API"]
  end

  PG --> V --> CMP --> L --> A --> API --> BE
```

*(Classic MVC shape: **view** + **logic** acts like UI + controller; **services** encapsulate API calls.)*

---

## Export

Paste each ` ```mermaid ` block (overview first, then §1–§3) into [mermaid.live](https://mermaid.live) and export PNG/SVG.

**UML class diagrams (corrected layers, policies, React mapping):** see [`class-diagrams.md`](./class-diagrams.md).

**Sequence diagrams** (ranking + trading): see [`sequence-diagrams.md`](./sequence-diagrams.md).

**Use cases** (user vs admin, PlantUML): see [`use-case-diagrams.md`](./use-case-diagrams.md) and [`plantuml/use-case-user.puml`](./plantuml/use-case-user.puml), [`plantuml/use-case-admin.puml`](./plantuml/use-case-admin.puml).

**Database ERD** (two PlantUML figures from migrations): [`database-erd.md`](./database-erd.md), [`plantuml/erd-user-domain.puml`](./plantuml/erd-user-domain.puml), [`plantuml/erd-instruments-domain.puml`](./plantuml/erd-instruments-domain.puml).
