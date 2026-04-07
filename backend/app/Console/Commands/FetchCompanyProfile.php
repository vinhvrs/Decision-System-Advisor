<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;

class FetchCompanyProfile extends Command
{
    protected $signature = 'stocks:fetch-profile';
    protected $description = 'Bootstrap company profiles (memory safe & batch insert)';

    public function handle()
    {
        $apiKey = env('FMP_API_KEY');

        if (!$apiKey) {
            $this->error("FMP_API_KEY missing in .env");
            return;
        }

        $batchSize = 50;
        $rows = [];

        DB::table('instruments')
            ->select('id', 'symbol')
            ->orderBy('id')
            ->chunkById(50, function ($instruments) use (&$rows, $batchSize, $apiKey) {

                foreach ($instruments as $instrument) {

                    // Skip if profile already exists
                    $exists = DB::table('company_profile')
                        ->where('symbol', $instrument->symbol)
                        ->exists();

                    if ($exists) {
                        continue;
                    }

                    $url = "https://financialmodelingprep.com/stable/profile?symbol={$instrument->symbol}&apikey={$apiKey}";
                    $response = Http::timeout(30)->get($url);

                    if (!$response->ok()) continue;

                    $data = $response->json();
                    if (empty($data) || !isset($data[0])) continue;

                    $profile = $data[0];

                    $rows[] = [
                        'instrument_id'       => $instrument->id,
                        'symbol'              => $instrument->symbol,
                        'company_name'        => $profile['companyName'] ?? null,
                        'image'               => $profile['image'] ?? null,
                        'sector'              => $profile['sector'] ?? null,
                        'industry'            => $profile['industry'] ?? null,
                        'description'         => $profile['description'] ?? null,
                        'ceo'                 => $profile['ceo'] ?? null,
                        'website'             => $profile['website'] ?? null,
                        'country'             => $profile['country'] ?? null,
                        'market_cap'          => $profile['marketCap'] ?? null,
                        'exchange'            => $profile['exchange'] ?? null,
                        'full_time_employees' => $profile['fullTimeEmployees'] ?? null,
                        'ipo_date'            => $profile['ipoDate'] ?? null,
                        'created_at'          => now(),
                        'updated_at'          => now(),
                    ];

                    if (count($rows) >= $batchSize) {
                        DB::table('company_profile')->insert($rows);
                        $this->info("Inserted batch of {$batchSize}");
                        $rows = [];
                    }

                    sleep(1); // rate limit
                }

            });

        // Insert remaining
        if (!empty($rows)) {
            DB::table('company_profile')->insert($rows);
            $this->info("Inserted remaining " . count($rows));
        }

        $this->info("Bootstrap completed.");
    }
}
