<?php

namespace App\Http\Controllers;

use App\Models\ContactSubmission;
use App\Models\SiteMailSetting;
use App\Services\EmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class PublicContactController extends Controller
{
    public function __construct(
        protected EmailService $emailService
    ) {}

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:320'],
            'subject' => ['required', 'string', 'max:512'],
            'message' => ['required', 'string', 'max:20000'],
        ]);

        $row = ContactSubmission::query()->create([
            'name' => $validated['name'],
            'email' => strtolower(trim($validated['email'])),
            'subject' => $validated['subject'],
            'message' => $validated['message'],
            'read_at' => null,
            'ip_address' => $request->ip(),
        ]);

        $notify = SiteMailSetting::effectiveContactNotificationEmail();
        if ($notify !== '') {
            try {
                $app = (string) config('app.name', 'DSA');
                $body = "New website contact ({$app})\n\n"
                    ."Name: {$row->name}\n"
                    ."Email: {$row->email}\n"
                    ."Subject: {$row->subject}\n\n"
                    ."Message:\n{$row->message}\n\n"
                    .'— Open Admin → Email desk to reply.';
                $this->emailService->sendPlain(
                    $notify,
                    "[{$app}] Contact: {$row->subject}",
                    $body,
                    $row->email
                );
            } catch (Throwable $e) {
                Log::warning('contact notify mail failed: '.$e->getMessage());
            }
        }

        return response()->json([
            'message' => 'Thanks — we received your message.',
            'id' => $row->id,
        ], 201);
    }
}
