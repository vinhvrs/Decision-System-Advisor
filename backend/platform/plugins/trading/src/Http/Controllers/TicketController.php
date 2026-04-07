<?php

namespace Platform\Plugins\Trading\Src\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Platform\Plugins\Trading\Src\Services\TicketService;

class TicketController extends Controller
{
    public function __construct(
        protected TicketService $ticketService
    ) {
    }

    /**
     * List tickets with pagination, select, and filters.
     * Query params: per_page, page, select (comma-separated), status, market, symbol, type, date_from, date_to
     */
    public function index(Request $request)
    {
        $userId = $request->user()->id;
        $filters = $request->only(['status', 'market', 'symbol', 'type', 'date_from', 'date_to']);
        $filters = array_filter($filters, fn ($v) => $v !== null && $v !== '');
        $perPage = (int) $request->input('per_page', 15);
        $page = $request->has('page') ? (int) $request->input('page') : null;
        $select = $request->filled('select')
            ? array_map('trim', explode(',', $request->input('select', '')))
            : null;

        $tickets = $this->ticketService->findByUser($userId, $filters, $perPage, $page, $select);
        return response()->json($tickets);
    }

    /**
     * Open positions with current price and profit/loss.
     * Compares current price (from market) with open price; profit/loss depends on type (Buy/Sell).
     */
    public function positions(Request $request)
    {
        $userId = $request->user()->id;
        $perPage = (int) $request->input('per_page', 15);

        $tickets = $this->ticketService->getOpenTicketsWithPnl($userId, $perPage);
        return response()->json(['data' => $tickets]);
    }

    public function indexOpenByUser(Request $request, string $user_id)
    {
        $perPage = (int) $request->input('per_page', 15);
        $page = $request->has('page') ? (int) $request->input('page') : null;
        $select = $request->filled('select') ? array_map('trim', explode(',', $request->input('select', ''))) : null;
        $tickets = $this->ticketService->findByUser($user_id, ['status' => 'open'], $perPage, $page, $select);
        return response()->json($tickets);
    }

    public function indexByUserAndSymbol(Request $request, string $user_id, string $symbol)
    {
        $perPage = (int) $request->input('per_page', 15);
        $page = $request->has('page') ? (int) $request->input('page') : null;
        $select = $request->filled('select') ? array_map('trim', explode(',', $request->input('select', ''))) : null;
        $tickets = $this->ticketService->findByUser($user_id, ['symbol' => $symbol], $perPage, $page, $select);
        return response()->json($tickets);
    }

    public function show(Request $request, string $id)
    {
        $ticket = $request->attributes->get('ticket') ?? $this->ticketService->find($id);
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        $withPnl = $request->boolean('with_pnl', false);
        if ($withPnl && $ticket->status === 'open') {
            $enriched = $this->ticketService->getTicketWithPnl($ticket);
            return response()->json($enriched);
        }

        return response()->json($ticket);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:Buy,Sell',
            'market' => 'required|in:stock,crypto,forex',
            'symbol' => 'required|string|max:32',
            'leverage' => 'nullable|numeric|min:0.0001|max:1000',
            'volume' => 'required|numeric|min:0.00000001',
            'price' => 'required|numeric|min:0',
        ]);

        $validated['user_id'] = $request->user()->id;
        $validated['leverage'] = $validated['leverage'] ?? 1;

        $ticket = $this->ticketService->create($validated);
        return response()->json($ticket, 201);
    }

    public function update(Request $request, string $id)
    {
        $validated = $request->validate([
            'status' => 'sometimes|in:open,closed,cancelled',
        ]);

        $ticket = $this->ticketService->update($id, $validated);
        return response()->json($ticket);
    }

    /**
     * Close an open position. ticket_id in body, POST or PUT.
     * close_price optional: if omitted, uses current market price.
     */
    public function closePosition(Request $request)
    {
        $validated = $request->validate([
            'ticket_id' => 'required|string|uuid',
            'close_price' => 'nullable|numeric|min:0',
        ]);

        $ticketId = $validated['ticket_id'];
        $closePrice = isset($validated['close_price']) ? (float) $validated['close_price'] : null;

        $ticket = $this->ticketService->closeWithBody($ticketId, $closePrice, $request->user()->id);
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found or not open'], 404);
        }
        return response()->json($ticket);
    }

    public function destroy(Request $request, string $id)
    {
        $deleted = $this->ticketService->delete($id);
        return response()->json(['deleted' => $deleted]);
    }
}
