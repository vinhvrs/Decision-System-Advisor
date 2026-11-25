# Danh mục route API của Decision System Advisor

Đối chiếu ngày **25/11/2026**. Backend lấy từ bảng route đã đăng ký trên Raspberry Pi. Frontend lấy từ bản Next.js của commit [`5c51cfdc`](https://github.com/vinhvrs/Decision-System-Advisor/commit/5c51cfdcef6fdffce87e0836fce831d0a2e63109) đang phục vụ [aitemple.tech](https://aitemple.tech/).

- **Laravel** có 124 mục đăng ký, gồm 119 mục dưới `/api/` và 5 mục hỗ trợ. Một mục có thể nhận nhiều HTTP method.
- **FastAPI** có 25 mục, gồm 19 HTTP API trong OpenAPI, 4 endpoint tài liệu và 2 WebSocket.
- **Next.js trên Vercel** có 3 handler API và 32 cấu hình chuyển tiếp. Một URL có cả handler và cấu hình chuyển tiếp. Bốn cấu hình chuyển tiếp hiện thiếu route ở Pi.
- **Next.js trên Pi** có route tài nguyên `/favicon.ico` và trang giao diện. Manifest của bản chạy trên Pi không có handler `/api/` hoặc cấu hình chuyển tiếp API.

`DATA` nghĩa là mẫu URL khớp quy tắc chuyển tiếp của `data.aitemple.tech` với tham số thông thường. Một số quy tắc giới hạn ký tự, nên một ký hiệu hợp lệ với backend vẫn có thể bị chặn ở lớp công khai. `PI` nghĩa là route có trong dịch vụ trên Pi và mẫu URL nằm ngoài quy tắc công khai đó. Cột này mô tả định tuyến, không biểu thị quyền truy cập hay bảo đảm HTTP 200.

Ở gateway Pi, `/api/v1/*` và `/ws/*` đi tới FastAPI, `/api/*` còn lại và `/storage/*` đi tới Laravel. Tại Vercel, chỉ các handler và đường chuyển tiếp dưới đây được tính. Các endpoint ghi dữ liệu, endpoint nội bộ và endpoint yêu cầu tài khoản được kiểm kê qua cấu hình và bảng route; lượt kiểm tra không gọi chúng.

## Vercel và Next.js

### Handler thực thi tại Next.js

```text
METHOD  ROUTE                          XỬ LÝ
GET     /api/v1/equity-quotes          Yahoo snapshot do Next.js cung cấp
GET     /api/v1/forexfactory-calendar  Lịch ForexFactory do Next.js cung cấp
GET     /api/v1/market-heatmap         Handler Next.js đọc snapshot từ Pi và giữ metadata
```

Next.js cung cấp HEAD và OPTIONS theo cơ chế Route Handler khi phù hợp. Danh sách trên ghi method được khai báo trong mã nguồn.

### Chuyển tiếp tới Pi

Đích của mỗi cấu hình là cùng đường dẫn tại `https://data.aitemple.tech`. Cột method ghi method đăng ký ở đích. Với `/api/v1/market-heatmap`, handler Next.js tại cùng URL được ưu tiên.

```text
METHOD TẠI PI        ROUTE VERCEL                           ĐỐI CHIẾU
POST                 /api/auth/login                        DATA
POST                 /api/auth/logout                       DATA
GET / HEAD           /api/companies/:symbol/overview        DATA
GET / HEAD           /api/filings/:symbol                   DATA
GET / HEAD           /api/fundamentals/:symbol/annual       DATA
GET / HEAD           /api/fundamentals/:symbol/quarterly    DATA
GET / HEAD           /api/instruments/data-history/:symbol  DATA
GET / HEAD           /api/market/daily-analytics            DATA
GET / HEAD           /api/market/daily-history/:symbol      DATA
GET / HEAD           /api/news                              DATA
DELETE / GET / HEAD  /api/news/:slug                        DATA
GET / HEAD           /api/news/symbol/:symbol               DATA
GET / HEAD           /api/rankings/beginner-board           DATA
GET / HEAD           /api/rankings/dashboard-daily          DATA
GET                  /api/v1/correlation                    DATA
GET                  /api/v1/crypto-context                 DATA
GET                  /api/v1/data-health                    DATA
—                    /api/v1/earnings/:symbol               404 · thiếu route tại Pi
GET                  /api/v1/economic-calendar              DATA
—                    /api/v1/estimates/:symbol              404 · thiếu route tại Pi
GET                  /api/v1/macro/dashboard                DATA
GET                  /api/v1/market-heatmap                 Handler Next.js được ưu tiên
GET                  /api/v1/metrics/:symbol                DATA
—                    /api/v1/options/:symbol                404 · thiếu route tại Pi
GET                  /api/v1/positioning/:symbol            DATA
GET                  /api/v1/realtime/status                DATA
—                    /api/v1/source-health                  404 · thiếu route tại Pi
GET                  /api/v1/sourced-fundamentals/:symbol   DATA
GET                  /api/v1/technical/:symbol              DATA
GET                  /api/v1/universe                       DATA
GET / HEAD / POST    /api/watchlist                         DATA
DELETE               /api/watchlist/:symbol                 DATA
```

## FastAPI trên Pi

Các mục dưới đây lấy từ router đã nạp. Danh sách HTTP nghiệp vụ được đối chiếu với `/openapi.json` của tiến trình đang chạy. Các mục `/internal/tasks/*` chỉ được liệt kê để kiểm kê.

```text
METHOD      ROUTE                                  LỚP CÔNG KHAI  HANDLER
GET         /                                      PI             root
GET         /api/v1/admin/data-backfill/catalog    PI             catalog
POST        /api/v1/chat                           PI             chat_endpoint
GET         /api/v1/correlation                    DATA           correlation
GET         /api/v1/crypto-context                 DATA           crypto_context
GET         /api/v1/data-health                    DATA           data_health
GET         /api/v1/economic-calendar              DATA           economic_calendar
POST        /api/v1/embed                          PI             embed
GET         /api/v1/macro/dashboard                DATA           macro
GET         /api/v1/market-heatmap                 DATA           market_heatmap
GET         /api/v1/metrics/{symbol}               DATA           metrics
GET         /api/v1/positioning/{symbol}           DATA           positioning
GET         /api/v1/realtime/status                DATA           realtime_status
GET         /api/v1/sourced-fundamentals/{symbol}  DATA           fundamentals
GET         /api/v1/technical/{symbol}             DATA           cached_technical
GET         /api/v1/universe                       DATA           universe
GET / HEAD  /docs                                  PI             swagger_ui_html
GET / HEAD  /docs/oauth2-redirect                  PI             swagger_ui_redirect
GET         /health/scheduler                      PI             health_scheduler
POST        /internal/tasks/dashboard-warm-up      PI             internal_dashboard_warm_up
POST        /internal/tasks/data-backfill          PI             internal_data_backfill
GET / HEAD  /openapi.json                          PI             openapi
GET / HEAD  /redoc                                 PI             redoc_html
WS          /ws/chatbot                            PI             chatbot_websocket
WS          /ws/quotes                             DATA           websocket_endpoint
```

## Laravel trên Pi

`GET / HEAD` nghĩa là Laravel đăng ký cả hai method cho cùng URL. Cột middleware ghi các lớp xác thực, phân quyền, audit và giới hạn tần suất do bảng route báo cáo. Dấu `—` nghĩa là không có middleware riêng ngoài nhóm `api` hoặc `web`. Controller và gateway có thể kiểm tra thêm.

### Admin

```text
METHOD      ROUTE                                                         LỚP CÔNG KHAI  HANDLER                               MIDDLEWARE
POST        /api/admin/auth/login                                         PI             AuthController@login                  ThrottleRequests:admin-login
GET / HEAD  /api/admin/companies                                          PI             CompanyManagementController@index     Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
GET / HEAD  /api/admin/companies/{symbol}                                 PI             CompanyManagementController@show      Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
PUT         /api/admin/companies/{symbol}                                 PI             CompanyManagementController@update    Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
GET / HEAD  /api/admin/data-backfill/catalog                              PI             DataBackfillController@catalog        Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
POST        /api/admin/data-backfill/run                                  PI             DataBackfillController@run            Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:30,1
GET / HEAD  /api/admin/email/config                                       PI             EmailController@config                Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:60,1
GET / HEAD  /api/admin/email/contact-submissions                          PI             ContactInboxController@index          Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:60,1
POST        /api/admin/email/contact-submissions/read-all                 PI             ContactInboxController@markAllRead    Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:30,1
POST        /api/admin/email/contact-submissions/{id}/read                PI             ContactInboxController@markRead       Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:30,1
GET / HEAD  /api/admin/email/contact-unread-count                         PI             ContactInboxController@unreadCount    Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:60,1
POST        /api/admin/email/inbound                                      PI             EmailController@recordInbound         Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:30,1
GET / HEAD  /api/admin/email/messages                                     PI             EmailController@messages              Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:60,1
POST        /api/admin/email/send                                         PI             EmailController@send                  Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:30,1
POST        /api/admin/email/test                                         PI             EmailController@sendTest              Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:30,1
GET / HEAD  /api/admin/indicators/catalog                                 PI             IndicatorParameterController@catalog  Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:60,1
GET / HEAD  /api/admin/indicators/{indicatorId}/parameters                PI             IndicatorParameterController@index    Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:60,1
POST        /api/admin/indicators/{indicatorId}/parameters                PI             IndicatorParameterController@store    Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:30,1
PUT         /api/admin/indicators/{indicatorId}/parameters/{parameterId}  PI             IndicatorParameterController@update   Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:30,1
DELETE      /api/admin/indicators/{indicatorId}/parameters/{parameterId}  PI             IndicatorParameterController@destroy  Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:30,1
GET / HEAD  /api/admin/logs                                               PI             LogViewerController@show              Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
GET / HEAD  /api/admin/logs/activity                                      PI             LogViewerController@activity          Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
GET / HEAD  /api/admin/logs/laravel-entries                               PI             LogViewerController@laravelEntries    Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
GET / HEAD  /api/admin/news                                               PI             NewsManagementController@index        Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
GET / HEAD  /api/admin/news/{id}                                          PI             NewsManagementController@show         Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
DELETE      /api/admin/news/{id}                                          PI             NewsManagementController@destroy      Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
GET / HEAD  /api/admin/site-mail-settings                                 PI             SiteMailSettingController@show        Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:60,1
PUT         /api/admin/site-mail-settings                                 PI             SiteMailSettingController@update      Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity, ThrottleRequests:30,1
GET / HEAD  /api/admin/statistics/most-watched                            PI             StatisticsController@mostWatched      Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
GET / HEAD  /api/admin/users                                              PI             UserManagementController@index        Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
GET / HEAD  /api/admin/users/{id}                                         PI             UserManagementController@show         Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
PUT         /api/admin/users/{id}                                         PI             UserManagementController@update       Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
PUT         /api/admin/users/{id}/role                                    PI             UserManagementController@updateRole   Authenticate:sanctum, EnsureAdminOrStaff, LogAdminApiActivity
```

### API ứng dụng

```text
METHOD      ROUTE                                        LỚP CÔNG KHAI  HANDLER                                    MIDDLEWARE
GET / HEAD  /api/analytics/{path}                        PI             DataMetricsController@show                 ThrottleRequests:120,1
POST        /api/auth/forgot-password                    PI             AuthController@forgotPasswordRequest       ThrottleRequests:5,1
POST        /api/auth/forgot-password/verify             PI             AuthController@forgotPasswordVerify        ThrottleRequests:12,1
POST        /api/auth/login                              DATA           AuthController@login                       ThrottleRequests:login
POST        /api/auth/logout                             DATA           AuthController@logout                      Authenticate:sanctum
POST        /api/auth/password/reset-temp                PI             AuthController@resetPasswordFromTemp       ThrottleRequests:12,1
POST        /api/auth/register/request-otp               PI             AuthController@registerRequestOtp          ThrottleRequests:5,1
POST        /api/auth/register/verify                    PI             AuthController@registerVerify              ThrottleRequests:12,1
GET / HEAD  /api/companies                               PI             CompanyController@index                    —
GET / HEAD  /api/companies/{symbol}                      PI             CompanyController@getProfileBySymbol       —
GET / HEAD  /api/companies/{symbol}/overview             DATA           CompanyController@getOverview              —
GET / HEAD  /api/companies/{symbol}/similar              PI             CompanyController@getSimilarCompanies      —
POST        /api/contact                                 PI             PublicContactController@store              ThrottleRequests:8,1
GET / HEAD  /api/contact/mail-display                    PI             PublicSiteMailController@contactDisplay    ThrottleRequests:60,1
GET / HEAD  /api/elastic/companies                       PI             ElasticController@searchCompanies          —
POST        /api/elastic/companies/reindex               PI             ElasticController@reindexCompanies         —
GET / HEAD  /api/elastic/companies/symbol/{symbol}       PI             ElasticController@companyBySymbol          —
GET / HEAD  /api/elastic/demo/top-symbols                PI             ElasticController@demoTopSymbols           —
GET / HEAD  /api/elastic/health                          PI             ElasticController@health                   —
GET / HEAD  /api/elastic/knowledge-docs                  PI             ElasticController@searchKnowledgeDocs      —
POST        /api/elastic/knowledge-docs/reindex          PI             ElasticController@reindexKnowledgeDocs     —
GET / HEAD  /api/elastic/knowledge-docs/symbol/{symbol}  PI             ElasticController@knowledgeDocsBySymbol    —
GET / HEAD  /api/elastic/search                          PI             ElasticController@search                   —
GET / HEAD  /api/filings/{symbol}                        DATA           FundamentalsController@filings             —
GET / HEAD  /api/fundamentals/screener                   PI             FundamentalsController@screener            —
GET / HEAD  /api/fundamentals/{symbol}                   PI             FundamentalsController@show                —
GET / HEAD  /api/fundamentals/{symbol}/annual            DATA           FundamentalsController@annual              —
GET / HEAD  /api/fundamentals/{symbol}/quarterly         DATA           FundamentalsController@quarterly           —
GET / HEAD  /api/fundamentals/{symbol}/score             PI             FundamentalsController@score               —
GET / HEAD  /api/indicator-config                        PI             IndicatorConfigController@show             ThrottleRequests:120,1
GET / HEAD  /api/instruments                             PI             InstrumentController@index                 —
GET / HEAD  /api/instruments/data                        PI             InstrumentDataController@index             —
GET / HEAD  /api/instruments/data-history/{symbol}       DATA           InstrumentDataController@getHistory        —
POST        /api/instruments/data/batch-daily-closes     PI             InstrumentDataController@batchDailyCloses  —
GET / HEAD  /api/instruments/data/period/{periodId}      PI             InstrumentDataController@showByPeriod      —
GET / HEAD  /api/instruments/data/{symbol}               PI             InstrumentDataController@get               —
GET / HEAD  /api/instruments/history-advice              PI             HistoryAdviceController@index              —
GET / HEAD  /api/instruments/history-data/{symbol}       PI             InstrumentDataController@getHistory        —
GET / HEAD  /api/instruments/market-coverage             PI             InstrumentController@marketCoverage        —
GET / HEAD  /api/instruments/periods/{id}                PI             InstrumentPeriodsController@show           —
DELETE      /api/instruments/{id}                        PI             InstrumentController@destroy               —
GET / HEAD  /api/instruments/{symbol}                    PI             InstrumentController@show                  —
GET / HEAD  /api/market/daily-analytics                  DATA           DailyMarketAnalyticsController             ThrottleRequests:60,1
GET / HEAD  /api/market/daily-history/{symbol}           DATA           DailyMarketHistoryController               ThrottleRequests:60,1
GET / HEAD  /api/news                                    DATA           NewsController@index                       —
GET / HEAD  /api/news/symbol/{symbol}                    DATA           NewsController@getBySymbol                 —
GET / HEAD  /api/news/{id}                               DATA           NewsController@show                        —
DELETE      /api/news/{id}                               DATA           NewsController@destroy                     —
GET / HEAD  /api/price-alerts                            PI             PriceAlertController@index                 Authenticate:sanctum
POST        /api/price-alerts                            PI             PriceAlertController@store                 Authenticate:sanctum, ThrottleRequests:30,1
DELETE      /api/price-alerts/{id}                       PI             PriceAlertController@destroy               Authenticate:sanctum
PATCH       /api/price-alerts/{id}/read                  PI             PriceAlertController@read                  Authenticate:sanctum
GET / HEAD  /api/rankings/beginner-board                 DATA           RankingController@beginnerBoard            —
GET / HEAD  /api/rankings/beginner-page/{symbol}         PI             RankingController@beginnerPage             —
GET / HEAD  /api/rankings/beginner-radar/{symbol}        PI             RankingController@beginnerRadar            —
GET / HEAD  /api/rankings/beginner/{symbol}              PI             RankingController@beginnerOverview         —
GET / HEAD  /api/rankings/bottom-liquidity               PI             RankingController@bottomLiquidity          —
GET / HEAD  /api/rankings/dashboard-daily                DATA           RankingController@dashboardDaily           —
GET / HEAD  /api/rankings/heatmap-daily                  PI             RankingController@heatmapDaily             —
GET / HEAD  /api/rankings/top-by-volume                  PI             RankingController@topByVolume              —
GET / HEAD  /api/rankings/top-companies                  PI             RankingController@topCompanies             —
GET / HEAD  /api/rankings/top-gainers                    PI             RankingController@topGainers               —
GET / HEAD  /api/rankings/top-liquidity                  PI             RankingController@topLiquidity             —
GET / HEAD  /api/rankings/top-losers                     PI             RankingController@topLosers                —
GET / HEAD  /api/rankings/top-market-cap                 PI             RankingController@topMarketCap             —
GET / HEAD  /api/stocks                                  PI             StockController@index                      —
POST        /api/stocks                                  PI             StockController@store                      —
POST        /api/stocks/advices/{symbol}                 PI             StockController@expertAdvices              —
GET / HEAD  /api/stocks/name/{name}                      PI             StockController@showByName                 —
GET / HEAD  /api/stocks/symbol/{symbol}                  PI             StockController@showBySymbol               —
GET / HEAD  /api/stocks/{id}                             PI             StockController@show                       —
PUT         /api/stocks/{id}                             PI             StockController@update                     —
DELETE      /api/stocks/{id}                             PI             StockController@destroy                    —
GET / HEAD  /api/tickets                                 PI             TicketController@index                     Authenticate:sanctum
POST        /api/tickets                                 PI             TicketController@store                     Authenticate:sanctum
POST        /api/tickets/close                           PI             TicketController@closePosition             Authenticate:sanctum
PUT         /api/tickets/close                           PI             TicketController@closePosition             Authenticate:sanctum
GET / HEAD  /api/tickets/positions                       PI             TicketController@positions                 Authenticate:sanctum
GET / HEAD  /api/tickets/user/{user_id}                  PI             TicketController@indexOpenByUser           Authenticate:sanctum, EnsureUserSelf
GET / HEAD  /api/tickets/user/{user_id}/{symbol}         PI             TicketController@indexByUserAndSymbol      Authenticate:sanctum, EnsureUserSelf
GET / HEAD  /api/tickets/{id}                            PI             TicketController@show                      Authenticate:sanctum, EnsureTicketOwner
PUT         /api/tickets/{id}                            PI             TicketController@update                    Authenticate:sanctum, EnsureTicketOwner
DELETE      /api/tickets/{id}                            PI             TicketController@destroy                   Authenticate:sanctum, EnsureTicketOwner
GET / HEAD  /api/watchlist                               DATA           WatchlistController@index                  Authenticate:sanctum
POST        /api/watchlist                               DATA           WatchlistController@store                  Authenticate:sanctum
DELETE      /api/watchlist/{symbol}                      DATA           WatchlistController@destroy                Authenticate:sanctum
```

### Route hỗ trợ

```text
METHOD      ROUTE                 LỚP CÔNG KHAI  HANDLER                    MIDDLEWARE
GET / HEAD  /                     PI             Closure                    —
GET / HEAD  /sanctum/csrf-cookie  PI             CsrfCookieController@show  —
GET / HEAD  /storage/{path}       PI             Closure                    —
GET / HEAD  /up                   PI             Closure                    —
GET / HEAD  /{any}                PI             Closure                    —
```

### Đường dẫn hợp lệ dưới `/api/analytics/{path}`

Laravel đăng ký một route tham số. Controller chỉ chấp nhận tám mẫu sau và chuyển tiếp GET tới FastAPI. Đây là các mẫu con của cùng route, không cộng thêm vào số mục đăng ký.

```text
METHOD      ROUTE                                         LỚP CÔNG KHAI
GET / HEAD  /api/analytics/correlation                    PI
GET / HEAD  /api/analytics/crypto-context                 PI
GET / HEAD  /api/analytics/data-health                    PI
GET / HEAD  /api/analytics/macro/dashboard                PI
GET / HEAD  /api/analytics/metrics/{symbol}               PI
GET / HEAD  /api/analytics/positioning/{symbol}           PI
GET / HEAD  /api/analytics/sourced-fundamentals/{symbol}  PI
GET / HEAD  /api/analytics/universe                       PI
```

## Kiểm chứng

- API macro trả `200` tại cả [data.aitemple.tech](https://data.aitemple.tech/api/v1/macro/dashboard) lẫn [aitemple.tech](https://aitemple.tech/api/v1/macro/dashboard).
- Bốn cấu hình thiếu route được thử bằng GET và trả `404` ở cả hai host. Các route tham số dùng mã AAPL.
- `GET /api/analytics/macro/dashboard` trả `404` qua cả hai host công khai. Route này được ghi lại từ Laravel để phản ánh phần backend đăng ký.
- Việc liệt kê không gọi các thao tác ghi dữ liệu, gửi mail, đăng nhập hay chạy job.
