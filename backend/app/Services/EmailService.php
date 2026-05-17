<?php

namespace App\Services;

use App\Models\SiteMailSetting;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Wraps Laravel mail using config/mail.php and .env (MAIL_MAILER, MAIL_HOST, …).
 *
 * - MAIL_MAILER=log: messages are written to the log channel (good for local dev).
 * - MAIL_MAILER=smtp: MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD (Gmail: use an app password).
 * - MAIL_CLIENT_ID / MAIL_CLIENT_SECRET: not used by default Laravel SMTP; optional for Google API / OAuth flows.
 */
class EmailService
{
    /**
     * Non-secret values for admin UI / health checks.
     */
    public function publicConfig(): array
    {
        $smtp = config('mail.mailers.smtp', []);
        $google = config('services.mail_google', []);

        $mailer = (string) config('mail.default', 'log');
        $from = trim((string) config('mail.from.address', ''));
        $smtpReady = $mailer === 'smtp'
            && ! empty($smtp['host'] ?? null)
            && ! empty($smtp['username'] ?? null)
            && ! empty($smtp['password'] ?? null)
            && $from !== '';

        $site = SiteMailSetting::singleton();
        $effectiveNotify = SiteMailSetting::effectiveContactNotificationEmail();

        return [
            'mailer' => $mailer,
            'from_address' => $from,
            'from_name' => (string) config('mail.from.name', ''),
            'smtp_host' => isset($smtp['host']) ? (string) $smtp['host'] : null,
            'smtp_port' => isset($smtp['port']) ? (int) $smtp['port'] : null,
            'smtp_scheme' => isset($smtp['scheme']) && $smtp['scheme'] !== null && $smtp['scheme'] !== ''
                ? (string) $smtp['scheme']
                : null,
            'smtp_auto_tls' => (bool) ($smtp['auto_tls'] ?? true),
            'smtp_username_set' => ! empty($smtp['username'] ?? null),
            'smtp_ready' => $smtpReady,
            'support_notify_configured' => $effectiveNotify !== '',
            'site_mail' => [
                'contact_notification_email' => $site->contact_notification_email,
                'support_public_email' => $site->support_public_email,
                'internal_notes' => $site->internal_notes,
                'effective_contact_notification_email' => $effectiveNotify,
            ],
            'google_oauth_client_configured' => ! empty($google['client_id'] ?? null),
        ];
    }

    /**
     * @throws Throwable
     */
    public function sendPlain(string $to, string $subject, string $body, ?string $replyTo = null): void
    {
        $from = trim((string) config('mail.from.address', ''));
        if ($from === '') {
            throw new \InvalidArgumentException(
                'MAIL_FROM_ADDRESS is empty. Set a valid sender in .env (required for SMTP and most mailers).'
            );
        }
        $fromName = (string) config('mail.from.name', '');

        Mail::raw($body, function ($message) use ($to, $subject, $replyTo, $from, $fromName): void {
            $message->to($to)->subject($subject);
            $message->from($from, $fromName);
            if ($replyTo !== null && $replyTo !== '') {
                $message->replyTo($replyTo);
            }
        });
    }

    /**
     * @throws Throwable
     */
    public function sendTest(string $to): void
    {
        $app = (string) config('app.name', 'DSA');
        $mailer = (string) config('mail.default', 'log');

        $body = "This is a test message from {$app}.\n\n"
            . "Active mailer: {$mailer}\n"
            . ($mailer === 'log'
                ? "Messages are written to the application log (e.g. storage/logs/laravel.log).\n"
                : "Sent via SMTP using MAIL_HOST / MAIL_USERNAME from .env.\n");

        $this->sendPlain($to, "[{$app}] Test email", $body);
    }
}
