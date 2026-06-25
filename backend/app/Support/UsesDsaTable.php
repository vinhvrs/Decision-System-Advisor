<?php

namespace App\Support;

/**
 * Resolve Eloquent model physical table from DEV_MODE via config/dsa.php.
 */
trait UsesDsaTable
{
    /** @return non-empty-string Logical key in config('dsa.tables') */
    abstract protected static function dsaLogicalTable(): string;

    public function getTable(): string
    {
        return DsaTables::name(static::dsaLogicalTable());
    }
}
