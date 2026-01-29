<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Platform\Plugins\Advisor\Src\LanguageSmoother;
use Platform\Plugins\Advisor\Src\DTO\SmoothContext;

class SmoothTest extends Command
{
    protected $signature = 'smooth:test';
    protected $description = 'Test language smoother';

    public function handle()
    {
        $s = new LanguageSmoother();

        $in = $s->smooth(
            "give me the full text analysis of AAPL and MSFT stock prices today, please",
            new SmoothContext(
                direction: 'in',
                stylePreset: 'standard',
                locale: 'en',
                debug: true      // 👈 BẬT LOG
            )
        );
        $this->info('IN cleanText: ' . $in->cleanText);
        $this->info('IN intent: ' . ($in->intent ?? 'null'));
        $this->info('IN entities: ' . json_encode($in->entities));

        if (isset($in->entities['tickers'])) {
            $ctxOut = new SmoothContext(
                direction: 'out',
                stylePreset: 'standard',
                locale: 'en',
                debug: true      // 👈 BẬT LOG
            );
            $ctxOut->memory = [
                'intent' => $in->intent,
                'entities' => $in->entities,
            ];

            $out = $s->smooth("Market data placeholder", $ctxOut);
            $this->info('OUT cleanText: ' . $out->cleanText);
        } else {
            $this->error('Tickers data is missing in entities.');
        }

        return 0;
    }
}
