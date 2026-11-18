<?php

namespace Tests\Unit;

use App\Support\DsaTables;
use Tests\TestCase;

class DsaTablesTest extends TestCase
{
    public function test_production_mode_resolves_production_tables(): void
    {
        config([
            'dsa.dev_mode' => 'production',
            'dsa.use_demo_tables' => false,
        ]);

        $this->assertFalse(DsaTables::useDemo());
        $this->assertSame('instrument_snapshot', DsaTables::name('instrument_snapshot'));
        $this->assertSame('instrument_data', DsaTables::name('instrument_data'));
    }

    public function test_demo_tables_require_explicit_demo_configuration(): void
    {
        config([
            'dsa.dev_mode' => 'dev',
            'dsa.use_demo_tables' => true,
        ]);

        $this->assertTrue(DsaTables::useDemo());
        $this->assertSame('snapshot_demo', DsaTables::name('instrument_snapshot'));
    }
}
