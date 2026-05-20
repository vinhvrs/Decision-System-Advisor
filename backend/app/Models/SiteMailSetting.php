<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Singleton-style row (single record) for admin-managed contact / support mail targets.
 */
class SiteMailSetting extends Model
{
    protected $table = 'site_mail_settings';

    protected $fillable = [
        'contact_notification_email',
        'support_public_email',
        'internal_notes',
    ];

    public static function tableReady(): bool
    {
        try {
            return Schema::hasTable('site_mail_settings');
        } catch (\Throwable) {
            return false;
        }
    }

    public static function singleton(): ?self
    {
        if (! self::tableReady()) {
            return null;
        }

        try {
            $row = self::query()->orderBy('id')->first();
            if ($row !== null) {
                return $row;
            }

            return self::query()->create([
                'contact_notification_email' => null,
                'support_public_email' => null,
                'internal_notes' => null,
            ]);
        } catch (QueryException $e) {
            Log::warning('site_mail_settings unavailable: '.$e->getMessage());

            return null;
        }
    }

    /** Effective address for contact-form staff notifications (DB overrides .env). */
    public static function effectiveContactNotificationEmail(): string
    {
        $row = self::singleton();
        $db = trim((string) ($row?->contact_notification_email ?? ''));

        return $db !== '' ? $db : trim((string) config('mail.support_address', ''));
    }

    public static function effectiveSupportPublicEmail(): ?string
    {
        $row = self::singleton();
        $db = trim((string) ($row?->support_public_email ?? ''));

        return $db !== '' ? $db : null;
    }
}
