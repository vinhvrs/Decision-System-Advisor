<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Support\Str;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        // User::factory()->create([
        //     'id' => (string) Str::uuid(),
        //     'username' => 'testuser',
        //     'name' => 'Test User',
        //     'email' => 'test@example.com',
        //     'password' => bcrypt('123456'),
        // ]);
        $this->call([
            StockEntitySeeder::class,
        ]);
    }
}
