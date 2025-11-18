<?php
/**
 * Script: create_structure.php
 * Mục đích: Tự động sinh ra skeleton plugin/module
 * Chạy: php create_structure.php
 */

$basePath = __DIR__ . '/platform/plugins/dsa-advisor'; // bạn có thể đổi sang 'platform/plugins/dsa-advisor'

$folders = [
    "config",
    "src/Providers",
    "src/Models",
    "src/Repositories/Interfaces",
    "src/Repositories/Eloquent",
    "src/Services",
    "src/Http/Controllers/Admin",
    "src/Http/Controllers/Public",
    "src/Http/Requests",
    "src/Database/migrations",
    "src/Database/seeders",
    "src/Routes",
    "resources/views/admin/signals",
    "resources/views/public",
    "resources/lang/en",
];

$files = [
    "plugin.json" => <<<JSON
{
  "name": "DSA Advisor",
  "namespace": "Modules\\DsaAdvisor\\",
  "provider": "Modules\\DsaAdvisor\\Providers\\DsaAdvisorServiceProvider",
  "author": "vinhvrs",
  "version": "1.0.0"
}
JSON,

    "config/config.php" => <<<PHP
<?php
return [
    'default_timeframe' => '1h',
];
PHP,

    "src/Providers/DsaAdvisorServiceProvider.php" => <<<PHP
<?php

namespace Modules\\DsaAdvisor\\Providers;

use Illuminate\\Support\\ServiceProvider;

class DsaAdvisorServiceProvider extends ServiceProvider
{
    public function register()
    {
        // bind repo/service tại đây
    }

    public function boot()
    {
        // load routes, migrations, views
    }
}
PHP,

    "src/Routes/web.php" => <<<PHP
<?php

use Illuminate\\Support\\Facades\\Route;

Route::group(['prefix' => 'dsa', 'as' => 'dsa.'], function () {
    Route::get('/signals', [Modules\\DsaAdvisor\\Http\\Controllers\\Public\\SignalsPublicController::class, 'index'])
        ->name('signals.index');
});
PHP,
];

// Tạo folder
foreach ($folders as $folder) {
    $path = "$basePath/$folder";
    if (!is_dir($path)) {
        mkdir($path, 0777, true);
        echo "Created: $path\n";
    }
}

// Tạo file mẫu
foreach ($files as $file => $content) {
    $path = "$basePath/$file";
    if (!file_exists($path)) {
        file_put_contents($path, $content);
        echo "Created file: $path\n";
    }
}

echo "✅ Structure for DSA Advisor created successfully!\n";
