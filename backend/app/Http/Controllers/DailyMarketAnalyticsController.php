<?php

namespace App\Http\Controllers;

use App\Services\DailyMarketAnalytics;
use App\Support\DsaTables;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class DailyMarketAnalyticsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $settings = config('dsa.market_sources', []);
        $environment = strtolower(app()->environment());
        $demo = filter_var($settings['public_demo'] ?? false, FILTER_VALIDATE_BOOL);
        $public = $demo || in_array($environment, ['production', 'prod'], true);
        $demoYahoo = $demo && filter_var($settings['yahoo_public_demo'] ?? false, FILTER_VALIDATE_BOOL);
        $allowYahoo = filter_var($settings['yahoo_enabled'] ?? true, FILTER_VALIDATE_BOOL)
            && ($demoYahoo || (!$demo && in_array($environment, ['local', 'dev', 'development', 'testing'], true)));
        $allowRedistribution = filter_var($settings['public_redistribution'] ?? false, FILTER_VALIDATE_BOOL);
        $policy = static function (string $source) use ($public, $allowYahoo, $allowRedistribution): bool {
            $source = strtolower(trim($source));
            if (in_array($source, ['yahoo', 'yahoo_finance', 'yfinancedaily'], true)
                || str_starts_with($source, 'yfinance')) {
                return $allowYahoo;
            }

            return !$public || ($allowRedistribution && !in_array($source, ['', 'unknown', 'legacy_unverified', 'unconfigured'], true));
        };
        $key = 'daily-market-analytics:v2:'.DsaTables::name('instrument_data').":$public:$allowYahoo:$allowRedistribution";
        $data = Cache::remember($key, now()->addMinutes(5), function () use ($policy) {
            $target = DsaTables::name('instrument_data');
            $assets = DB::table('market_assets')->where('enabled', 1)->orderBy('symbol')->get(['id', 'symbol', 'market'])->keyBy('symbol');
            $slugs = $assets->keys()->mapWithKeys(fn ($symbol) => [strtolower($symbol).'-daily' => $symbol]);
            $periods = DB::table(DsaTables::name('instrument_periods'))
                ->whereIn('slug', $slugs->keys())->pluck('id', 'slug');
            $today = now('America/New_York')->toDateString();
            $oldest = now('America/New_York')->subYears(2)->toDateString();

            return $slugs->mapWithKeys(function ($symbol, $slug) use ($assets, $periods, $target, $today, $oldest, $policy) {
                $asset = $assets->get($symbol);
                $period = $periods->get($slug);
                $observations = $period ? DB::table($target.' as bar')
                    ->leftJoin('market_rollup_state as state', function ($join) use ($asset, $target) {
                        $join->on('state.bucket_date', '=', DB::raw('DATE(bar.timestamps)'))
                            ->where('state.asset_id', $asset->id)->where('state.target', $target)->where('state.period', 'daily');
                    })
                    ->leftJoin('market_rollup_sources as provenance', function ($join) {
                        $join->on('provenance.asset_id', '=', 'state.asset_id')
                            ->on('provenance.target', '=', 'state.target')->on('provenance.period', '=', 'state.period')
                            ->on('provenance.bucket_date', '=', 'state.bucket_date');
                    })
                    ->where('bar.instrument_period_id', $period)
                    ->where('bar.timestamps', '>=', $oldest)
                    ->where('bar.timestamps', '<', $today)
                    ->where(function ($query) {
                        $query->where('bar.source', '<>', 'rollup_30m_v1')->orWhereNull('bar.source')->orWhere('state.is_final', true);
                    })
                    ->orderByDesc('bar.timestamps')->orderByDesc('bar.updated_at')->orderByDesc('bar.id')
                    ->limit(400)->get(['bar.timestamps', 'bar.close', 'bar.high', 'bar.low', 'bar.volume', 'bar.source', 'provenance.source_codes_json'])
                    ->unique(fn ($bar) => substr((string) $bar->timestamps, 0, 10))
                    ->reverse()->values()->all() : [];
                foreach ($observations as $bar) {
                    $sources = $bar->source === 'rollup_30m_v1'
                        ? (json_decode($bar->source_codes_json ?? '[]', true) ?: ['LEGACY_UNVERIFIED'])
                        : [$bar->source ?: 'LEGACY_UNVERIFIED'];
                    $sources = array_unique(array_map(static function (string $code): string {
                        $code = strtoupper(trim($code));
                        return str_starts_with($code, 'YFINANCE') || in_array($code, ['YAHOO', 'YAHOO_FINANCE'], true)
                            ? 'YFINANCE_DEV' : $code;
                    }, $sources));
                    sort($sources);
                    $bar->source = implode(', ', $sources);
                    if (in_array($asset->market, ['forex', 'index'], true)) {
                        $bar->volume = null;
                    }
                }

                return [$symbol => DailyMarketAnalytics::summarize(
                    $observations,
                    fn ($source) => collect(explode(', ', $source))->every($policy)
                )];
            });
        });

        return response()->json(['data' => (object) $data->all()]);
    }
}
