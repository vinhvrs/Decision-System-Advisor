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

        $in = $s->smooth("give me news nvda today no image full text, include ohclv!!!", new SmoothContext('in','standard','en'));
        $this->info('IN cleanText: ' . $in->cleanText);
        $this->info('IN intent: ' . ($in->intent ?? 'null'));
        $this->info('IN entities: ' . json_encode($in->entities));

        $out = $s->smooth("nvda marketcap is huge   and volitility is high", new SmoothContext('out','concise','en'));
        $this->info('OUT cleanText: ' . $out->cleanText);

        return 0;
    }
}
