<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteMailSetting;
use Illuminate\Http\Request;

class SiteMailSettingController extends Controller
{
    public function show()
    {
        $row = SiteMailSetting::singleton();
        if ($row === null) {
            return response()->json([
                'message' => 'Mail settings table is missing. Run database migrations.',
            ], 503);
        }

        return response()->json([
            'data' => [
                'contact_notification_email' => $row->contact_notification_email,
                'support_public_email' => $row->support_public_email,
                'internal_notes' => $row->internal_notes,
                'effective_contact_notification_email' => SiteMailSetting::effectiveContactNotificationEmail(),
                'env_support_fallback' => trim((string) config('mail.support_address', '')) !== '',
            ],
        ]);
    }

    public function update(Request $request)
    {
        $payload = collect($request->only([
            'contact_notification_email',
            'support_public_email',
            'internal_notes',
        ]))->map(function ($v) {
            if (! is_string($v)) {
                return $v;
            }
            $t = trim($v);

            return $t === '' ? null : $t;
        })->all();

        $request->merge($payload);

        $validated = $request->validate([
            'contact_notification_email' => ['nullable', 'email', 'max:320'],
            'support_public_email' => ['nullable', 'email', 'max:320'],
            'internal_notes' => ['nullable', 'string', 'max:10000'],
        ]);

        $row = SiteMailSetting::singleton();
        if ($row === null) {
            return response()->json([
                'message' => 'Mail settings table is missing. Run database migrations.',
            ], 503);
        }
        $row->fill([
            'contact_notification_email' => $validated['contact_notification_email'] ?? null,
            'support_public_email' => $validated['support_public_email'] ?? null,
            'internal_notes' => $validated['internal_notes'] ?? null,
        ]);
        $row->save();

        return response()->json([
            'message' => 'Mail settings saved.',
            'data' => [
                'contact_notification_email' => $row->contact_notification_email,
                'support_public_email' => $row->support_public_email,
                'internal_notes' => $row->internal_notes,
                'effective_contact_notification_email' => SiteMailSetting::effectiveContactNotificationEmail(),
            ],
        ]);
    }
}
