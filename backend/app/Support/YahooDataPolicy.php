<?php
namespace App\Support;

final class YahooDataPolicy
{
    public static function allowed(): bool
    {
        return app()->environment(['local','testing'])
            && filter_var(env('ALLOW_YFINANCE_DEV_FALLBACK',true),FILTER_VALIDATE_BOOLEAN)
            && (!filter_var(env('PUBLIC_DEMO',false),FILTER_VALIDATE_BOOLEAN)
                || filter_var(env('ALLOW_YFINANCE_PUBLIC_DEMO',false),FILTER_VALIDATE_BOOLEAN));
    }
}
