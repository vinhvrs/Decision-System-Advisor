<?php

namespace App\Services;

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
     *
     * @return array{
     *   mailer: string,
     *   from_address: string,
     *   from_name: string,
     *   smtp_host: string|null,
     *   smtp_port: int|null,
     *   smtp_scheme: string|null,
     *   smtp_auto_tls: bool,
     *   smtp_username_set: bool,
     *   google_oauth_client_configured: bool
     * }
     */
    public function publicConfig(): array
    {
        $smtp = config('mail.mailers.smtp', []);
        $google = config('services.mail_google', []);

        return [
            'mailer' => (string) config('mail.default', 'log'),
            'from_address' => (string) config('mail.from.address', ''),
            'from_name' => (string) config('mail.from.name', ''),
            'smtp_host' => isset($smtp['host']) ? (string) $smtp['host'] : null,
            'smtp_port' => isset($smtp['port']) ? (int) $smtp['port'] : null,
            'smtp_scheme' => isset($smtp['scheme']) && $smtp['scheme'] !== null && $smtp['scheme'] !== ''
                ? (string) $smtp['scheme']
                : null,
            'smtp_auto_tls' => (bool) ($smtp['auto_tls'] ?? true),
            'smtp_username_set' => ! empty($smtp['username'] ?? null),
            'google_oauth_client_configured' => ! empty($google['client_id'] ?? null),
        ];
    }

    /**
     * @throws Throwable
     */
    public function sendPlain(string $to, string $subject, string $body, ?string $replyTo = null): void
    {
        Mail::raw($body, function ($message) use ($to, $subject, $replyTo): void {
            $message->to($to)->subject($subject);
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
