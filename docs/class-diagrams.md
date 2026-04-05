# Class diagrams (revised for thesis)

UML-style **Mermaid `classDiagram`** sources that **fix** the earlier sketches:

| Topic | What changed |
|--------|----------------|
| **Laravel** | Route **bootstrap + route files + plugins** (not only `RouteServiceProvider::boot/map`). **Policies** are per-model Laravel classes with `before()` where used—no generic `PolicyInterface` with `after()`. **Auth** flow matches this repo: controller uses **repository + mail**, not necessarily a custom `AuthService` class. **Elasticsearch** appears explicitly. |
| **Python** | Aligns with **modules** actually present; **no chatbot NLP class** on the diagram. **No Redis pub/sub** requirement; **WebSocket** is in-process. Ingest is mostly **functions / scripts**, not a shared ABC—`BaseCollector` is optional and shown only as a **conceptual** pattern. Method names in the diagram use **snake_case** to match Python style. |
| **Frontend** | **Next.js / React** does not use separate MVC controller **classes**; the middle column is **UI coordinators** (hooks/handlers in real code). **No chat page** on this thesis figure. **Admin** depends on **`AdminService`**, not only knowledge search. |

Render in [mermaid.live](https://mermaid.live) or a Mermaid-capable editor.

---

## 1. Laravel backend (layered)

```mermaid
classDiagram
  direction TB

  class RouteRegistration {
    <<route registration>>
    bootstrapWithRouting()
    coreRoutesApiWebAdminElastic()
    pluginRouteGroupsTrading()
  }

  class MiddlewarePipeline {
    <<middleware>>
    handleRequestNext()
    sanctumThrottleAliases()
  }

  class UserPolicy {
    <<policy>>
    beforeOptional()
    modelRules()
  }

  class AuthController {
    +login(Request)
    +logout()
    +registerOtpFlow()
  }

  class NewsController {
    +index()
    +show(slug)
  }

  class ElasticController {
    +searchProxy()
  }

  class EmailService {
    +sendPlain(to, subject, body)
  }

  class NewsService {
    +list()
    +transform()
  }

  class ElasticCompanySearchService {
    +search(query)
  }

  class UserRepository {
    +findByEmail(email)
    +create(data)
  }

  class NewsRepository {
    +paginate()
    +findBySlug(slug)
  }

  class User {
    fillableFields()
    hiddenFields()
    relations()
  }

  class News {
    fillableFields()
    casts()
  }

  class MySQL {
    <<store>>
  }

  class Redis {
    <<store>>
  }

  class Elasticsearch {
    <<store>>
  }

  RouteRegistration ..> MiddlewarePipeline : applies
  MiddlewarePipeline ..> AuthController : dispatches
  MiddlewarePipeline ..> NewsController : dispatches
  MiddlewarePipeline ..> ElasticController : dispatches
  MiddlewarePipeline ..> UserPolicy : policy checks

  AuthController --> UserRepository
  AuthController --> EmailService
  UserRepository --> User
  User --> MySQL

  NewsController --> NewsService
  NewsController --> NewsRepository
  NewsService --> NewsRepository
  NewsRepository --> News
  News --> MySQL
  NewsService ..> Redis : cache optional

  ElasticController --> ElasticCompanySearchService
  ElasticCompanySearchService --> Elasticsearch
```

---

## 2. Python engine (pipelines & services)

**Flow (what to read from the arrows):** ingest jobs **write** to **MySQL** and feed **tabular pipelines** (`RawDataPreprocessor` → `IndicatorService`). **Analysis** is triggered from **FastAPI** (`AutoAnalyzeService`): it **reads** OHLC-style data from **MySQL**, calls **`ElasticRetriever`** for text search hits, writes **Redis** via **`AnalysisCacheService`**, and does **not** receive RSS rows directly from **`NewsIngest`** (no ingest → Elasticsearch shortcut).

```mermaid
classDiagram
  direction TB

  class BaseCollector {
    <<interface>>
    +collect()
  }

  class NewsIngest {
    +run_rss_crawl()
    +persist_knowledge_docs()
  }

  class MarketIngest {
    +sync_ohlc_and_corporate()
    +persist_market_rows()
  }

  class RawDataPreprocessor {
    +normalize(df)
    +clean_missing(df)
    +resample(df, freq)
  }

  class IndicatorService {
    +prepare_dataframe(df)
    +calculate_indicators(df)
  }

  class AutoAnalyzeService {
    +analyze_symbol()
    +merge_retrieval_context()
  }

  class ElasticRetriever {
    +search(query_text, limit)
  }

  class MarketSyncService {
    +sync()
    +write_heatmap_and_rankings()
  }

  class AnalysisCacheService {
    +get_analysis(symbol)
    +set_analysis(symbol, payload)
  }

  class FastAPIApp {
    +include_routers()
    +lifespan_jobs()
  }

  class ConnectionManager {
    +accept_websocket()
    +stream_market_updates()
  }

  class MySQL {
    <<store>>
  }

  class Redis {
    <<store>>
  }

  class Elasticsearch {
    <<store>>
  }

  BaseCollector <|.. NewsIngest
  BaseCollector <|.. MarketIngest

  NewsIngest --> MySQL
  MarketIngest --> MySQL

  NewsIngest --> RawDataPreprocessor : feature tables
  MarketIngest --> RawDataPreprocessor : OHLCV series

  RawDataPreprocessor --> IndicatorService
  IndicatorService --> AutoAnalyzeService

  AutoAnalyzeService --> ElasticRetriever
  ElasticRetriever --> Elasticsearch

  AutoAnalyzeService --> AnalysisCacheService
  AnalysisCacheService --> Redis

  AutoAnalyzeService ..> MySQL : read candles and docs

  MarketSyncService --> MySQL
  MarketSyncService --> Redis

  FastAPIApp --> NewsIngest : schedules jobs
  FastAPIApp --> MarketIngest : schedules jobs
  FastAPIApp --> AutoAnalyzeService : HTTP analyze
  FastAPIApp --> MarketSyncService : jobs API
  FastAPIApp --> ConnectionManager : mount WS
```

\*`BaseCollector` is **not** a real shared ABC in the repo; ingest is implemented as **modules** (`news_crawler`, `stock_sync`, …). The interface is only for **thesis clarity**.

---

## 3. Frontend (Next.js — logical MVC mapping)

```mermaid
classDiagram
  direction LR

  class HomePage {
    +render()
    +marketSections()
  }

  class LoginPage {
    +render()
    +formState()
  }

  class ProfilePage {
    +render()
    +profileFormState()
  }

  class AdminDashboardPage {
    +render()
    +moduleLinks()
  }

  class MarketCoordinator {
    <<UI logic hooks>>
    +loadRankingsHeatmap()
  }

  class AuthCoordinator {
    <<UI logic hooks>>
    +submitLogin()
  }

  class ProfileCoordinator {
    <<UI logic hooks>>
    +update form
  }

  class AdminCoordinator {
    <<UI logic hooks>>
    +adminModules()
  }

  class HeatmapService {
    +API calls
  }

  class InstrumentService {
    +API calls
  }

  class AuthService {
    +login(credentials)
    +logout()
  }

  class AdminService {
    +usersCRUD()
    +companiesCRUD()
    +newsAdmin()
    +logsAndStats()
  }

  class ElasticService {
    +search API
  }

  class HttpClient {
    axiosBaseUrl()
    cookiesOrAuthHeader()
  }

  class LaravelAPI {
    <<external>>
  }

  HomePage --> MarketCoordinator
  LoginPage --> AuthCoordinator
  ProfilePage --> ProfileCoordinator
  AdminDashboardPage --> AdminCoordinator

  MarketCoordinator --> HeatmapService
  MarketCoordinator --> InstrumentService
  AuthCoordinator --> AuthService
  ProfileCoordinator --> AuthService
  AdminCoordinator --> AdminService
  AdminCoordinator --> ElasticService

  HeatmapService --> HttpClient
  InstrumentService --> HttpClient
  AuthService --> HttpClient
  AdminService --> HttpClient
  ElasticService --> HttpClient

  HttpClient --> LaravelAPI
```

**Note:** `*Coordinator` stands for **effects and handlers** that in the real project live **inside** `page.tsx` / components (e.g. `useState`, `useEffect`, `onSubmit`), not separate `.ts` classes.

---

## Export

Copy each ` ```mermaid ` block into [mermaid.live](https://mermaid.live) for PNG/SVG.
