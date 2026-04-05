<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EmailMessage;
use App\Services\EmailService;
use Illuminate\Http\Request;
use Throwable;

class EmailController extends Controller
{
    public function __construct(
        protected EmailService $emailService
    ) {}

    public function config()
    {
        return response()->json([
            'data' => $this->emailService->publicConfig(),
        ]);
    }

    public function messages(Request $request)
    {
        $perPage = min(100, max(5, (int) $request->query('per_page', 25)));

        $query = EmailMessage::query()
            ->with(['adminUser:id,name,email', 'clientUser:id,name,email'])
            ->orderByDesc('created_at');

        if ($request->filled('direction')) {
            $query->where('direction', $request->query('direction'));
        }

        return response()->json($query->paginate($perPage));
    }

    public function sendTest(Request $request)
    {
        $validated = $request->validate([
            'to' => ['required', 'email'],
        ]);

        $from = (string) config('mail.from.address', '');
        $app = (string) config('app.name', 'DSA');

        try {
            $this->emailService->sendTest($validated['to']);

            try {
                EmailMessage::query()->create([
                    'admin_user_id' => $request->user()->id,
                    'client_user_id' => null,
                    'direction' => EmailMessage::DIRECTION_OUTBOUND,
                    'from_email' => $from !== '' ? $from : 'noreply@localhost',
                    'to_email' => $validated['to'],
                    'subject' => "[{$app}] Test email",
                    'body_text' => '(test message body omitted in archive)',
                    'status' => 'sent',
                    'error_message' => null,
                ]);
            } catch (\Throwable) {
                /* archive is optional; delivery already succeeded */
            }

            return response()->json([
                'message' => 'Message sent (or logged, if MAIL_MAILER=log).',
                'mailer' => config('mail.default'),
            ]);
        } catch (Throwable $e) {
            try {
                EmailMessage::query()->create([
                    'admin_user_id' => $request->user()->id,
                    'client_user_id' => null,
                    'direction' => EmailMessage::DIRECTION_OUTBOUND,
                    'from_email' => $from !== '' ? $from : 'noreply@localhost',
                    'to_email' => $validated['to'],
                    'subject' => "[{$app}] Test email",
                    'body_text' => '',
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                ]);
            } catch (\Throwable) {
            }

            return response()->json([
                'message' => 'Failed to send email.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function send(Request $request)
    {
        $validated = $request->validate([
            'to' => ['required', 'email'],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:50000'],
            'reply_to' => ['nullable', 'email'],
            'client_user_id' => ['nullable', 'uuid', 'exists:users,id'],
        ]);

        $from = (string) config('mail.from.address', '');
        if ($from === '') {
            $from = 'noreply@localhost';
        }

        try {
            $this->emailService->sendPlain(
                $validated['to'],
                $validated['subject'],
                $validated['body'],
                $validated['reply_to'] ?? null
            );

            try {
                EmailMessage::query()->create([
                    'admin_user_id' => $request->user()->id,
                    'client_user_id' => $validated['client_user_id'] ?? null,
                    'direction' => EmailMessage::DIRECTION_OUTBOUND,
                    'from_email' => $from,
                    'to_email' => $validated['to'],
                    'subject' => $validated['subject'],
                    'body_text' => $validated['body'],
                    'status' => 'sent',
                    'error_message' => null,
                ]);
            } catch (\Throwable) {
            }

            return response()->json([
                'message' => 'Email sent (or logged, if MAIL_MAILER=log).',
                'mailer' => config('mail.default'),
            ]);
        } catch (Throwable $e) {
            try {
                EmailMessage::query()->create([
                    'admin_user_id' => $request->user()->id,
                    'client_user_id' => $validated['client_user_id'] ?? null,
                    'direction' => EmailMessage::DIRECTION_OUTBOUND,
                    'from_email' => $from,
                    'to_email' => $validated['to'],
                    'subject' => $validated['subject'],
                    'body_text' => $validated['body'],
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                ]);
            } catch (\Throwable) {
            }

            return response()->json([
                'message' => 'Failed to send email.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Log a client-to-support message (manual paste until IMAP/webhook is wired).
     */
    public function recordInbound(Request $request)
    {
        $validated = $request->validate([
            'from_email' => ['required', 'email'],
            'to_email' => ['required', 'email'],
            'subject' => ['required', 'string', 'max:512'],
            'body_text' => ['required', 'string', 'max:50000'],
            'client_user_id' => ['nullable', 'uuid', 'exists:users,id'],
        ]);

        $msg = EmailMessage::query()->create([
            'admin_user_id' => $request->user()->id,
            'client_user_id' => $validated['client_user_id'] ?? null,
            'direction' => EmailMessage::DIRECTION_INBOUND,
            'from_email' => $validated['from_email'],
            'to_email' => $validated['to_email'],
            'subject' => $validated['subject'],
            'body_text' => $validated['body_text'],
            'status' => 'received',
            'error_message' => null,
        ]);

        return response()->json([
            'message' => 'Client support message recorded.',
            'data' => $msg->load(['adminUser:id,name,email', 'clientUser:id,name,email']),
        ], 201);
    }
}
