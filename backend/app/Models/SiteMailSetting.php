<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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

    public static function singleton(): self
    {
        $row = self::query()->orderBy('id')->first();
        if ($row !== null) {
            return $row;
        }

        return self::query()->create([
            'contact_notification_email' => null,
            'support_public_email' => null,
            'internal_notes' => null,
        ]);
    }

    /** Effective address for contact-form staff notifications (DB overrides .env). */
    public static function effectiveContactNotificationEmail(): string
    {
        $db = trim((string) (self::singleton()->contact_notification_email ?? ''));

        return $db !== '' ? $db : trim((string) config('mail.support_address', ''));
    }
}
