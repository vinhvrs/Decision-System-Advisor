<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Contracts\Console\Kernel as ConsoleKernel;
use App\Console\Kernel as AppConsoleKernel;

return Application::configure(basePath: dirname(__DIR__))
    ->withBindings([
        ConsoleKernel::class => AppConsoleKernel::class,
    ])
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        // then: function () {
        //     // Load all plugin route files
        //     foreach (glob(base_path('platform/plugins/*/src/Routes/*.php')) as $routeFile) {
        //         require $routeFile;
        //     }
        // }
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'ticket.owner' => \App\Http\Middleware\EnsureTicketOwner::class,
            'user.self' => \App\Http\Middleware\EnsureUserSelf::class,
            'api.auth' => \App\Http\Middleware\EnsureApiAuthenticated::class,
            'admin.staff' => \App\Http\Middleware\EnsureAdminOrStaff::class,
            'admin.activity' => \App\Http\Middleware\LogAdminApiActivity::class,
        ]);
        $middleware->prependToGroup('api', \App\Http\Middleware\AddTokenFromCookie::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
