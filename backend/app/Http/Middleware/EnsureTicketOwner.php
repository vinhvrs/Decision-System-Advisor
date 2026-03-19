<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Platform\Plugins\Trading\Src\Models\Ticket;
use Symfony\Component\HttpFoundation\Response;

class EnsureTicketOwner
{
    /**
     * Ensure the authenticated user owns the ticket (authorization).
     */
    public function handle(Request $request, Closure $next, string $param = 'id'): Response
    {
        $id = $request->route($param);
        if (!$id) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        $ticket = Ticket::find($id);
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        if ($ticket->user_id !== $request->user()?->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->attributes->set('ticket', $ticket);

        return $next($request);
    }
}
