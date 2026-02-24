<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AnalyzeNewsTimeline extends Command
{
    protected $signature = 'news:timeline-analyze {ticker?}';
    protected $description = 'Analyze structured news events and build timeline report';

    public function handle()
    {
        $ticker = $this->argument('ticker');

        $query = DB::table('knowledge');

        if ($ticker) {
            $query->where('topic', 'like', "%{$ticker}%");
        }

        $events = $query->orderBy('published_at')->get();

        if ($events->isEmpty()) {
            $this->warn("No events found.");
            return;
        }

        $this->info("==== Timeline Analysis ====\n");

        // 1️⃣ Group by month
        $timeline = [];

        foreach ($events as $event) {

            $month = Carbon::parse($event->published_at)->format('Y-m');

            if (!isset($timeline[$month])) {
                $timeline[$month] = [
                    'total' => 0,
                    'types' => []
                ];
            }

            $timeline[$month]['total']++;

            $type = $event->topic;

            if (!isset($timeline[$month]['types'][$type])) {
                $timeline[$month]['types'][$type] = 0;
            }

            $timeline[$month]['types'][$type]++;
        }

        // 2️⃣ Calculate average events per month
        $totalMonths = count($timeline);
        $totalEvents = array_sum(array_column($timeline, 'total'));
        $avgPerMonth = $totalEvents / max($totalMonths, 1);

        $this->info("Total Events: {$totalEvents}");
        $this->info("Total Months: {$totalMonths}");
        $this->info("Average Events / Month: " . round($avgPerMonth, 2));
        $this->line("");

        // 3️⃣ Print timeline + density
        foreach ($timeline as $month => $data) {

            $density = $data['total'] / max($avgPerMonth, 1);
            $densityLabel = $density > 2 ? "🔥 SPIKE" : "";

            $this->info("{$month} → {$data['total']} events | Density: "
                . round($density, 2) . " {$densityLabel}");

            foreach ($data['types'] as $type => $count) {
                $this->line("   - {$type}: {$count}");
            }

            $this->line("");
        }

        // 4️⃣ Global event type ranking
        $typeCounts = [];

        foreach ($timeline as $data) {
            foreach ($data['types'] as $type => $count) {
                if (!isset($typeCounts[$type])) {
                    $typeCounts[$type] = 0;
                }
                $typeCounts[$type] += $count;
            }
        }

        arsort($typeCounts);

        $this->info("==== Event Type Ranking ====");

        foreach ($typeCounts as $type => $count) {
            $this->line("{$type} → {$count}");
        }

        $this->line("");
        $this->info("Timeline analysis completed.");
    }
}
