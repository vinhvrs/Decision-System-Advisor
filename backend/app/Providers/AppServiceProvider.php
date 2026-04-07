<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Platform\Plugins\Advisor\Src\Services\QdrantService;
use Platform\Plugins\Advisor\Src\Services\Context\QdrantRetriever;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(QdrantService::class, function () {
            return QdrantService::fromEnv();
        });

        $this->app->singleton(QdrantRetriever::class, function ($app) {
            return new QdrantRetriever($app->make(QdrantService::class));
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('admin-login', function (Request $request) {
            return Limit::perMinute(3)->by($request->ip());
        });

        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });
    }
}
