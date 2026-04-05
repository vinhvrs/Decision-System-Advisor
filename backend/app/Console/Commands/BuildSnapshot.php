<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BuildSnapshot extends Command
{
    protected $signature = 'snapshot:build';
    protected $description = 'Build instrument snapshot table';

    public function handle()
    {
        $this->info("Building snapshot...");

        $now = now();

        // All daily instrument periods
        $periods = DB::table('instrument_periods')
            ->where('period', 'daily')
            ->select('id', 'instrument_id')
            ->get();

        $insert = [];

        foreach ($periods as $p) {

            // Latest candle by created_at
            $d = DB::table('instrument_data')
                ->where('instrument_period_id', $p->id)
                ->orderByDesc('created_at')
                ->first();

            if (!$d) continue;
            if (!$d->open || $d->open <= 0) continue;

            $price = (float)$d->close;
            $volume = (float)$d->volume;
            $liq = $price * $volume;
            $change = (($price - $d->open) / $d->open) * 100;

            $symbol = DB::table('instruments')
                ->where('id', $p->instrument_id)
                ->value('symbol');

            \Log::info("Snapshot: {$symbol} | Price: {$price} | Open: {$d->open} | Volume: {$volume} | Liquidity: {$liq} | Change%: " . round($change,2) );

            $insert[] = [
                'instrument_id' => $p->instrument_id,
                'symbol' => $symbol,
                'price' => $price,
                'open' => (float)$d->open,
                'volume' => $volume,
                'liquidity' => $liq,
                'change_pct' => round($change, 2),
                'updated_at' => $now
            ];

            try {
                DB::table('instrument_snapshot')->updateOrInsert(
                    ['instrument_id' => $p->instrument_id],
                    [
                        'symbol' => $symbol,
                        'price' => $price,
                        'open' => (float)$d->open,
                        'volume' => $volume,
                        'liquidity' => $liq,
                        'change_pct' => round($change, 2),
                        'updated_at' => $now
                    ]
                );
            } catch (\Exception $e) {
                \Log::error("Snapshot update error for instrument_id={$p->instrument_id}: " . $e->getMessage());
            }
        }

        $this->info("Fetched: " . count($insert));

        // foreach (array_chunk($insert, 1000) as $chunk) {
        //     DB::table('instrument_snapshot')->upsert(
        //         $chunk,
        //         ['instrument_id'],
        //         ['price','open','volume','liquidity','change_pct','updated_at']
        //     );
        // }

        $this->info("Snapshot updated.");
        return Command::SUCCESS;
    }
}
