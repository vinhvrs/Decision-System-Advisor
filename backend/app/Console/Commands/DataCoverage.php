<?php

namespace App\Console\Commands;

use App\Support\DsaTables;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DataCoverage extends Command
{
    protected $signature = 'data:coverage
        {--limit=100 : Maximum snapshot symbols to inspect}
        {--symbols= : Comma-separated symbol override}
        {--fail-missing : Return a non-zero exit code when a symbol has fewer than two persisted daily bars}';

    protected $description = 'Audit persisted daily OHLC coverage for the live snapshot universe.';

    public function handle(): int
    {
        $limit = max(1, min(500, (int) $this->option('limit')));
        $symbols = collect(explode(',', (string) $this->option('symbols')))
            ->map(fn ($symbol) => strtoupper(trim((string) $symbol)))
            ->filter()
            ->unique()
            ->values();

        $snapshotTable = DsaTables::name('instrument_snapshot');
        $periodTable = DsaTables::name('instrument_periods');
        $dataTable = DsaTables::name('instrument_data');

        $coverage = DB::table($periodTable.' as p')
            ->leftJoin($dataTable.' as d', 'd.instrument_period_id', '=', 'p.id')
            ->where('p.period', 'daily')
            ->groupBy('p.instrument_id')
            ->select([
                'p.instrument_id',
                DB::raw('COUNT(d.id) as daily_bars'),
                DB::raw('MIN(d.timestamps) as first_bar'),
                DB::raw('MAX(d.timestamps) as last_bar'),
            ]);

        $query = DB::table($snapshotTable.' as s')
            ->leftJoinSub($coverage, 'h', function ($join) {
                $join->on('h.instrument_id', '=', 's.instrument_id');
            })
            ->whereNotNull('s.symbol')
            ->where('s.symbol', '<>', '')
            ->orderByDesc('s.volume')
            ->limit($limit)
            ->select([
                's.instrument_id',
                's.symbol',
                's.price',
                's.updated_at as snapshot_updated_at',
                DB::raw('COALESCE(h.daily_bars, 0) as daily_bars'),
                'h.first_bar',
                'h.last_bar',
            ]);

        if ($symbols->isNotEmpty()) {
            $query->whereIn(DB::raw('UPPER(s.symbol)'), $symbols->all());
        }

        $rows = $query->get();
        $table = [];
        $missing = 0;
        $short = 0;
        $ok = 0;

        foreach ($rows as $row) {
            $bars = (int) ($row->daily_bars ?? 0);
            $status = $bars >= 2 ? 'OK' : ($bars === 1 ? 'SHORT' : 'MISSING');

            if ($status === 'OK') {
                $ok++;
            } elseif ($status === 'SHORT') {
                $short++;
            } else {
                $missing++;
            }

            $table[] = [
                strtoupper((string) $row->symbol),
                (string) $row->instrument_id,
                $bars,
                $row->first_bar ?: '—',
                $row->last_bar ?: '—',
                $row->snapshot_updated_at ?: '—',
                $status,
            ];
        }

        $this->table(
            ['Symbol', 'Instrument ID', 'Daily bars', 'First bar', 'Last bar', 'Snapshot updated', 'Status'],
            $table
        );

        $this->newLine();
        $this->line(sprintf(
            'Coverage summary: total=%d ok=%d short=%d missing=%d',
            $rows->count(),
            $ok,
            $short,
            $missing
        ));

        if ($rows->isEmpty()) {
            $this->warn('No snapshot symbols matched the requested universe.');

            return self::FAILURE;
        }

        if ($this->option('fail-missing') && ($missing > 0 || $short > 0)) {
            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
