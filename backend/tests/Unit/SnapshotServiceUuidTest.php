<?php

namespace Tests\Unit;

use Platform\Plugins\Trading\Src\Services\SnapshotService;
use ReflectionMethod;
use Tests\TestCase;

class SnapshotServiceUuidTest extends TestCase
{
    public function test_daily_snapshot_update_accepts_uuid_string_instrument_id(): void
    {
        $method = new ReflectionMethod(SnapshotService::class, 'updateFromDailyCandle');
        $parameters = $method->getParameters();

        $this->assertCount(1, $parameters);
        $this->assertNotNull($parameters[0]->getType());
        $this->assertSame('string', $parameters[0]->getType()->getName());
    }
}
