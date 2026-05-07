<?php

require base_path('/platform/plugins/trading/src/Routes/InstrumentRoute.php');
require base_path('/platform/plugins/trading/src/Routes/StockRoute.php');
// require base_path('/platform/plugins/trading/src/Routes/KnowledgeRoute.php');
require base_path('/platform/plugins/trading/src/Routes/NewsRoute.php');
require base_path('/platform/plugins/trading/src/Routes/SimilarSignalRoute.php');
require base_path('/platform/plugins/trading/src/Routes/AuthRoute.php');
require base_path('/platform/plugins/trading/src/Routes/MarketTickRoute.php');
require base_path('/platform/plugins/trading/src/Routes/AnalysisRoute.php');
// Legacy route file name retained for backward compatibility.
require base_path('/platform/plugins/trading/src/Routes/AnalysistRoute.php');
require base_path('/platform/plugins/trading/src/Routes/RankingRoute.php');
require base_path('/platform/plugins/trading/src/Routes/CompanyRoute.php');
require base_path('/platform/plugins/trading/src/Routes/TicketRoute.php');
require base_path('/platform/plugins/users/src/Routes/WatchlistRoute.php');
require base_path('/routes/admin.php');

require base_path('/routes/elastic.php');
