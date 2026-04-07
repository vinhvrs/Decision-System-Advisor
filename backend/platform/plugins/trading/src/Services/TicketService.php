<?php

namespace Platform\Plugins\Trading\Src\Services;

use Platform\Plugins\Trading\Src\Models\Ticket;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\TicketRepository;
use Illuminate\Pagination\LengthAwarePaginator;

class TicketService
{
    public function __construct(
        protected TicketRepository $ticketRepository,
        protected PriceQuoteService $priceQuoteService
    ) {
    }

    public function create(array $data): Ticket
    {
        $data['open'] = $data['open'] ?? now();
        $data['status'] = $data['status'] ?? 'open';
        return $this->ticketRepository->create($data);
    }

    public function find(string $id): ?Ticket
    {
        return $this->ticketRepository->find($id);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  array<string>|null  $select
     */
    public function findByUser(string $userId, array $filters = [], int $perPage = 15, ?int $page = null, ?array $select = null): LengthAwarePaginator
    {
        return $this->ticketRepository->findByUser($userId, $filters, $perPage, $page, $select);
    }

    public function update(string $id, array $data): ?Ticket
    {
        return $this->ticketRepository->update($id, $data);
    }

    public function close(string $id, float $closePrice): ?Ticket
    {
        $ticket = $this->ticketRepository->find($id);
        if (!$ticket || $ticket->status !== 'open') {
            return null;
        }

        $profit = $ticket->type === 'Buy'
            ? Ticket::calcRealProfit($closePrice, (float) $ticket->price, (float) $ticket->leverage, (float) $ticket->volume)
            : -Ticket::calcRealProfit($closePrice, (float) $ticket->price, (float) $ticket->leverage, (float) $ticket->volume);

        return $this->ticketRepository->update($id, [
            'status' => 'closed',
            'profit' => $profit,
            'close' => now(),
        ]);
    }

    /**
     * Close position by ticket_id from body. Uses current market price if close_price omitted.
     */
    public function closeWithBody(string $ticketId, ?float $closePrice, string $userId): ?Ticket
    {
        $ticket = $this->ticketRepository->find($ticketId);
        if (!$ticket || $ticket->user_id !== $userId || $ticket->status !== 'open') {
            return null;
        }

        if ($closePrice === null || $closePrice <= 0) {
            $closePrice = $this->priceQuoteService->getCurrentPrice($ticket->symbol);
            if ($closePrice === null || $closePrice <= 0) {
                return null;
            }
        }

        return $this->close($ticketId, $closePrice);
    }

    public function delete(string $id): bool
    {
        return $this->ticketRepository->delete($id);
    }

    /**
     * Get open tickets for user with current price and profit/loss.
     * Compares current price with open price; profit or loss depends on ticket type (Buy/Sell).
     */
    public function getOpenTicketsWithPnl(string $userId, int $perPage = 15): array
    {
        $tickets = $this->ticketRepository->findByUser($userId, ['status' => 'open'], $perPage);
        return $this->enrichTicketsWithPnl($tickets->items());
    }

    /**
     * Get single ticket with current price and profit/loss (for open tickets).
     */
    public function getTicketWithPnl(Ticket $ticket): array
    {
        $items = $this->enrichTicketsWithPnl([$ticket]);
        return $items[0] ?? null;
    }

    /**
     * Enrich tickets with current_price, profit, and is_profit.
     * Buy: profit when current > open; Sell: profit when current < open.
     */
    protected function enrichTicketsWithPnl(array $tickets): array
    {
        if (empty($tickets)) {
            return [];
        }

        $symbols = array_unique(array_map(fn ($t) => $t->symbol, $tickets));
        $prices = $this->priceQuoteService->getCurrentPrices($symbols);

        return array_map(function (Ticket $t) use ($prices) {
            $openPrice = (float) $t->price;
            $currentPrice = $prices[$t->symbol] ?? null;
            $volume = (float) $t->volume;
            $leverage = (float) ($t->leverage ?? 1);

            $data = $t->toArray();
            $data['current_price'] = $currentPrice;

            if ($currentPrice === null || $openPrice <= 0) {
                $data['profit'] = null;
                $data['is_profit'] = null;
                $data['pnl_status'] = 'unknown';
                return $data;
            }

            if ($t->type === 'Buy') {
                $profit = Ticket::calcRealProfit($currentPrice, $openPrice, $leverage, $volume);
            } else {
                $profit = -Ticket::calcRealProfit($currentPrice, $openPrice, $leverage, $volume);
            }

            $data['profit'] = round($profit, 8);
            $data['is_profit'] = $profit >= 0;
            $data['pnl_status'] = $profit > 0 ? 'profit' : ($profit < 0 ? 'loss' : 'breakeven');

            return $data;
        }, $tickets);
    }
}
