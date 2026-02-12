<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class ExtractNewsEvents extends Command
{
    protected $signature = 'news:extract-events {limit=50}';
    protected $description = 'Extract structured events from raw news without AI API';

    public function handle()
    {
        $limit = (int) $this->argument('limit');

        $chunks = DB::table('knowledge_chunks')
            ->whereJsonContains('data->status', 'raw_news')
            ->limit($limit)
            ->get();

        foreach ($chunks as $chunk) {

            $meta = json_decode($chunk->data, true);
            $text = strtolower($chunk->content);

            // 1️⃣ Detect Event Type
            $eventType = $this->detectEventType($text);

            // 2️⃣ Detect Sentiment
            $sentiment = $this->detectSentiment($text);

            // 3️⃣ Estimate Impact (keyword intensity)
            $impactScore = $this->estimateImpact($text);

            // nếu không phải event quan trọng
            if ($eventType === null) {
                $this->updateStatus($chunk->id, 'filtered');
                continue;
            }

            $knowledgeId = (string) Str::uuid();

            DB::table('knowledge')->insert([
                'id'           => $knowledgeId,
                'topic'        => ucfirst($eventType) . " event",
                'content'      => $chunk->content,
                'author'       => 'system',
                'url_slug'     => Str::slug($chunk->content),
                'published_at' => Carbon::parse($meta['event_date']),
                'created_at'   => now(),
                'updated_at'   => now()
            ]);

            DB::table('knowledge_chunks')
                ->where('id', $chunk->id)
                ->update([
                    'knowledge_id' => $knowledgeId,
                    'data' => json_encode(array_merge($meta, [
                        'status' => 'processed',
                        'event_type' => $eventType,
                        'sentiment' => $sentiment,
                        'impact_score' => $impactScore
                    ]))
                ]);

            $this->info("Processed chunk {$chunk->id}");
        }

        $this->info("Extraction completed.");
    }

    private function detectEventType($text)
    {
        $map = [
            'earnings'    => ['earnings', 'revenue', 'profit', 'quarter'],
            'analyst'     => ['upgrade', 'downgrade', 'price target'],
            'macro'       => ['fed', 'inflation', 'interest rate', 'jobs report'],
            'product'     => ['launch', 'introduces', 'unveils'],
            'regulatory'  => ['regulator', 'antitrust', 'lawsuit', 'fine']
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
        $bullish = ['surge', 'beat', 'rise', 'strong', 'growth', 'record'];
        $bearish = ['drop', 'fall', 'plunge', 'miss', 'weak', 'decline'];

        $bull = 0;
        $bear = 0;

        foreach ($bullish as $word) {
            if (Str::contains($text, $word)) $bull++;
        }

        foreach ($bearish as $word) {
            if (Str::contains($text, $word)) $bear++;
        }

        if ($bull > $bear) return 'bullish';
        if ($bear > $bull) return 'bearish';
        return 'neutral';
    }

    private function estimateImpact($text)
    {
        $strongWords = ['record', 'massive', 'largest', 'biggest', 'plunge', 'surge'];

        $score = 0.3;

        foreach ($strongWords as $word) {
            if (Str::contains($text, $word)) {
                $score += 0.15;
            }
        }

        return min($score, 1);
    }

    private function updateStatus($id, $status)
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
