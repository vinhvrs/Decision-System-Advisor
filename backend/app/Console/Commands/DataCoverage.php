<?php

namespace App\Console\Commands;

use App\Support\DsaTables;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DataCoverage extends Command
{
    protected $signature = 'data:coverage
        {--symbols= : Comma-separated symbol override}
        {--limit=100 : Maximum symbols from snapshot/all-stock universe}
        {--min-bars=90 : Minimum distinct persisted daily trading days required for chart coverage}';

    protected $description = 'Audit persisted daily OHLC coverage versus the live dashboard snapshot universe.';

    public function handle(): int
    {
        $limit = max(1, min(500, (int) $this->option('limit')));
        $minBars = max(2, min(5000, (int) $this->option('min-bars')));

        $instrumentsTable = DsaTables::name('instruments');
        $periodsTable = DsaTables::name('instrument_periods');
        $dataTable = DsaTables::name('instrument_data');
        $snapshotTable = DsaTables::name('instrument_snapshot');

        $explicit = collect(explode(',', (string) $this->option('symbols')))
            ->map(fn ($symbol) => strtoupper(trim((string) $symbol)))
            ->filter()
            ->unique()
            ->values();

        if ($explicit->isNotEmpty()) {
            $symbols = $explicit;
        } else {
            $symbols = DB::table($snapshotTable)
                ->whereNotNull('symbol')
                ->where('symbol', '<>', '')
                ->orderByDesc('volume')
                ->limit($limit)
                ->pluck('symbol')
                ->map(fn ($symbol) => strtoupper(trim((string) $symbol)))
                ->filter()
                ->unique()
                ->values();

            if ($symbols->isEmpty()) {
                $symbols = DB::table($instrumentsTable)
                    ->where('type', 'stock')
                    ->orderBy('symbol')
                    ->limit($limit)
                    ->pluck('symbol')
                    ->map(fn ($symbol) => strtoupper(trim((string) $symbol)))
                    ->filter()
                    ->unique()
                    ->values();
            }
        }

        if ($symbols->isEmpty()) {
            $this->warn('No stock symbols found in the selected DSA table set.');
            return self::FAILURE;
        }

        $coverageSub = DB::table($periodsTable.' as p')
            ->leftJoin($dataTable.' as d', 'd.instrument_period_id', '=', 'p.id')
            ->where('p.period', 'daily')
            ->groupBy('p.instrument_id')
            ->selectRaw(
                'p.instrument_id,
                 COUNT(d.id) as daily_bars,
                 COUNT(DISTINCT DATE(d.timestamps)) as daily_days,
                 MIN(d.timestamps) as first_bar,
                 MAX(d.timestamps) as last_bar,
                 GROUP_CONCAT(DISTINCT COALESCE(d.source, "unknown") ORDER BY d.source SEPARATOR ",") as sources'
            );

        $rows = DB::table($instrumentsTable.' as i')
            ->leftJoinSub($coverageSub, 'c', 'c.instrument_id', '=', 'i.id')
            ->leftJoin($snapshotTable.' as s', 's.instrument_id', '=', 'i.id')
            ->where('i.type', 'stock')
            ->whereIn(DB::raw('UPPER(i.symbol)'), $symbols->all())
            ->get([
                'i.id as instrument_id',
                'i.symbol',
                's.price as snapshot_price',
                's.updated_at as snapshot_updated_at',
                DB::raw('COALESCE(c.daily_bars, 0) as daily_bars'),
                DB::raw('COALESCE(c.daily_days, 0) as daily_days'),
                'c.first_bar',
                'c.last_bar',
                'c.sources',
            ])
            ->keyBy(fn ($row) => strtoupper(trim((string) $row->symbol)));

        $table = [];
        $missing = 0;
        $short = 0;
        $ok = 0;
        $duplicateRows = 0;

        foreach ($symbols as $symbol) {
            $row = $rows->get($symbol);
            $bars = $row ? (int) $row->daily_bars : 0;
            $days = $row ? (int) $row->daily_days : 0;
            $duplicates = max(0, $bars - $days);
            $duplicateRows += $duplicates;

            if ($days === 0) {
                $state = 'MISSING';
                $missing++;
            } elseif ($days < $minBars) {
                $state = 'SHORT';
                $short++;
            } elseif ($duplicates > 0) {
                $state = 'DUPLICATE';
            } else {
                $state = 'OK';
                $ok++;
            }

            $snapshotAge = '—';
            if ($row && $row->snapshot_updated_at) {
                try {
                    $minutes = Carbon::parse($row->snapshot_updated_at)->diffInMinutes(now());
                    $snapshotAge = $minutes.'m';
                } catch (\Throwable) {
                    $snapshotAge = '?';
                }
            }

            $table[] = [
                $symbol,
                $row && $row->snapshot_price !== null
                    ? number_format((float) $row->snapshot_price, 4, '.', '')
                    : '—',
                $snapshotAge,
                $bars,
                $days,
                $duplicates,
                $row && $row->sources ? (string) $row->sources : '—',
                $row && $row->first_bar ? (string) $row->first_bar : '—',
                $row && $row->last_bar ? (string) $row->last_bar : '—',
                $state,
            ];
        }

        $this->table(
            ['Symbol', 'Snapshot', 'Snap age', 'Daily bars', 'Daily days', 'Dup rows', 'Sources', 'First bar', 'Last bar', 'State'],
            $table
        );

        $this->newLine();
        $this->info(sprintf(
            'Coverage: %d/%d OK (min %d distinct daily days) | SHORT=%d | MISSING=%d | DUP_ROWS=%d | DEV_MODE=%s',
            $ok,
            count($symbols),
            $minBars,
            $short,
            $missing,
            $duplicateRows,
            DsaTables::devMode()
        ));

        if ($duplicateRows > 0) {
            $this->warn(
                'Duplicate daily rows detected. Do not auto-delete them; inspect source/timestamps before cleanup.'
            );
        }

        if ($missing > 0 || $short > 0 || $duplicateRows > 0) {
            $this->warn(
                'Use the canonical Python DSATurbo/admin market backfill for missing history; data:periods is not scheduled.'
            );
            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
