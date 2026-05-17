<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactSubmission;
use Illuminate\Http\Request;

class ContactInboxController extends Controller
{
    public function unreadCount()
    {
        $n = ContactSubmission::query()->whereNull('read_at')->count();

        return response()->json(['data' => ['count' => $n]]);
    }

    public function index(Request $request)
    {
        $perPage = min(100, max(5, (int) $request->query('per_page', 25)));

        return response()->json(
            ContactSubmission::query()
                ->orderByDesc('created_at')
                ->paginate($perPage)
        );
    }

    public function markRead(Request $request, string $id)
    {
        $row = ContactSubmission::query()->findOrFail($id);
        $row->markRead();

        return response()->json(['message' => 'Marked read.', 'data' => $row]);
    }

    public function markAllRead(Request $request)
    {
        ContactSubmission::query()->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['message' => 'All marked read.']);
    }
}
