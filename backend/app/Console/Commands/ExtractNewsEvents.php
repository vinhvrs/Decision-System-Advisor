<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Carbon\Carbon;

class ExtractNewsEvents extends Command
{
    protected $signature = 'news:extract-events {limit=20}';
    protected $description = 'Extract structured events from raw news using LLM';

    public function handle()
    {
        $limit = (int) $this->argument('limit');

        $chunks = DB::table('knowledge_chunks')
            ->whereNull('knowledge_id')
            ->whereJsonContains('data->status', 'raw_news')
            ->limit($limit)
            ->get();

        if ($chunks->isEmpty()) {
            $this->info("No raw news found.");
            return;
        }

        foreach ($chunks as $chunk) {

            $meta = json_decode($chunk->data, true);

            $prompt = $this->buildPrompt($chunk->content, $meta);

            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . env('OPENAI_API_KEY'),
                'Content-Type' => 'application/json'
            ])->post('https://api.openai.com/v1/chat/completions', [
                        'model' => 'gpt-4o-mini',
                        'messages' => [
                            ['role' => 'system', 'content' => 'You are a financial event classifier. Return JSON only.'],
                            ['role' => 'user', 'content' => $prompt]
                        ],
                        'temperature' => 0.2
                    ]);

            if (!$response->ok()) {
                $this->error("LLM failed for chunk {$chunk->id}");
                continue;
            }

            $content = $response->json()['choices'][0]['message']['content'] ?? null;

            if (!$content)
                continue;

            $event = json_decode($content, true);

            if (!$event || empty($event['is_event']) || !$event['is_event']) {
                $this->updateChunkStatus($chunk->id, 'filtered');
                continue;
            }

            $knowledgeId = (string) Str::uuid();

            DB::table('knowledge')->insert([
                'id' => $knowledgeId,
                'topic' => $event['summary'] ?? 'Unknown event',
                'content' => $event['summary'] ?? '',
                'author' => 'LLM',
                'url_slug' => Str::slug($event['summary'] ?? 'event'),
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
                        'event_type' => $event['event_type'] ?? null,
                        'sentiment' => $event['sentiment'] ?? null,
                        'impact_score' => $event['impact_score'] ?? 0
                    ]))
                ]);

            $this->info("Event extracted for chunk {$chunk->id}");
        }

        $this->info("Extraction completed.");
    }

    private function buildPrompt($text, $meta)
    {
        return "
Company: {$meta['company']}
Ticker: {$meta['ticker']}
Event Date: {$meta['event_date']}

News Title:
{$text}

Classify and extract event in JSON:

{
  \"is_event\": true/false,
  \"event_type\": \"earnings | analyst | macro | product | regulatory | other\",
  \"sentiment\": \"bullish | bearish | neutral\",
  \"impact_score\": 0.0-1.0,
  \"summary\": \"short event summary\"
}
";
    }

    private function updateChunkStatus($id, $status)
    {
        $chunk = DB::table('knowledge_chunks')->where('id', $id)->first();
        if (!$chunk)
            return;

        $meta = json_decode($chunk->data, true);
        $meta['status'] = $status;

        DB::table('knowledge_chunks')
            ->where('id', $id)
            ->update(['data' => json_encode($meta)]);
    }
}
