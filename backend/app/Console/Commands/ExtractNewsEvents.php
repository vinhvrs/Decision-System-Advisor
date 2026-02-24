<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class ExtractNewsEvents extends Command
{
    protected $signature = 'news:extract-events {limit=20}';
    protected $description = 'Extract structured events from raw news (NO external API)';

    public function handle()
    {
        $limit = (int) $this->argument('limit');

        $chunks = DB::table('knowledge_chunks')
    ->whereNull('knowledge_id')
    ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(data,'$.status')) = 'embedded'")
    ->limit($limit)
    ->get();

        if ($chunks->isEmpty()) {
            $this->info("No raw news found.");
            return;
        }

        foreach ($chunks as $chunk) {

            $meta = json_decode($chunk->data, true);
            if (!$meta) continue;

            $analysis = $this->analyzeText($chunk->content);

            if (!$analysis['is_event']) {
                $this->updateChunkStatus($chunk->id, 'filtered');
                continue;
            }

            $knowledgeId = (string) Str::uuid();

            DB::table('knowledge')->insert([
                'id' => $knowledgeId,
                'topic' => $analysis['summary'],
                'content' => $analysis['summary'],
                'author' => 'system',
                'url_slug' => Str::slug($analysis['summary']),
                'published_at' => Carbon::parse($meta['event_date']),
                'created_at' => now(),
                'updated_at' => now()
            ]);

            DB::table('knowledge_chunks')
                ->where('id', $chunk->id)
                ->update([
                    'knowledge_id' => $knowledgeId,
                    'data' => json_encode(array_merge($meta, [
                        'status' => 'processed',
                        'event_type' => $analysis['event_type'],
                        'sentiment' => $analysis['sentiment'],
                        'impact_score' => $analysis['impact_score']
                    ]))
                ]);

            $this->info("✓ Event extracted {$chunk->id}");
        }

        $this->info("Extraction completed.");
    }

    private function analyzeText($text)
    {
        $text = strtolower($text);

        $eventType = $this->detectEventType($text);
        $sentiment = $this->detectSentiment($text);
        $impact = $this->estimateImpact($text);

        $isEvent = $eventType !== null;

        return [
            'is_event' => $isEvent,
            'event_type' => $eventType ?? 'other',
            'sentiment' => $sentiment,
            'impact_score' => $impact,
            'summary' => ucfirst($eventType ?? 'General') . " event detected"
        ];
    }

    private function detectEventType($text)
    {
        $map = [
            'earnings' => ['earnings', 'revenue', 'profit', 'quarter', 'guidance'],
            'analyst' => ['upgrade', 'downgrade', 'price target', 'rating'],
            'macro' => ['fed', 'inflation', 'interest rate', 'jobs report'],
            'product' => ['launch', 'introduces', 'unveils', 'release'],
            'regulatory' => ['lawsuit', 'antitrust', 'fine', 'regulator'],
            'merger' => ['acquire', 'merger', 'acquisition', 'buyout']
        ];

        foreach ($map as $type => $keywords) {
            foreach ($keywords as $word) {
                if (Str::contains($text, $word)) {
                    return $type;
                }
            }
        }

        return null;
    }

    private function detectSentiment($text)
    {
        $bullish = ['surge', 'beat', 'rise', 'strong', 'record', 'growth'];
        $bearish = ['drop', 'fall', 'plunge', 'miss', 'weak', 'decline'];

        $bull = 0;
        $bear = 0;

        foreach ($bullish as $w) {
            if (Str::contains($text, $w)) $bull++;
        }

        foreach ($bearish as $w) {
            if (Str::contains($text, $w)) $bear++;
        }

        if ($bull > $bear) return 'bullish';
        if ($bear > $bull) return 'bearish';
        return 'neutral';
    }

    private function estimateImpact($text)
    {
        $strongWords = ['record', 'massive', 'largest', 'biggest', 'plunge', 'surge'];

        $score = 0.3;

        foreach ($strongWords as $w) {
            if (Str::contains($text, $w)) {
                $score += 0.15;
            }
        }

        // detect percentage change
        if (preg_match('/\d+%/', $text)) {
            $score += 0.2;
        }

        return min($score, 1);
    }

    private function updateChunkStatus($id, $status)
    {
        $chunk = DB::table('knowledge_chunks')->where('id', $id)->first();
        if (!$chunk) return;

        $meta = json_decode($chunk->data, true);
        $meta['status'] = $status;

        DB::table('knowledge_chunks')
            ->where('id', $id)
            ->update(['data' => json_encode($meta)]);
    }
}
