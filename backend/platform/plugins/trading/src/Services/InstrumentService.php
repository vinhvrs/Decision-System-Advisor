<?php
namespace Platform\Plugins\Trading\Src\Services;
use Illuminate\Support\Facades\Http;
use Platform\Plugins\Trading\Src\Models\Instruments;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\InstrumentDataRepository;
use Illuminate\Support\Facades\Log;

class InstrumentService
{
    protected InstrumentDataRepository $instrumentDataRepository;

    public function __construct(InstrumentDataRepository $instrumentDataRepository)
    {
        $this->instrumentDataRepository = $instrumentDataRepository;
    }

    public function index()
    {
        $data = $this->instrumentDataRepository->findAll([], ['*'], 15);
        return $data;
    }

    public function show($symbol, $period, $perPage, $page)
    {
        $data = $this->instrumentDataRepository->get($symbol, $period, $perPage, $page);
        return $data;
    }

    /**
     * Historical bars by symbol in a time range.
     *
     * @return list<array{timestamps: mixed, open: float|int|null, high: float|int|null, low: float|int|null, close: float|int|null, volume: float|int|null}>
     */
    public function history(string $symbol, string $period, string $from, string $to): array
    {
        $period = strtolower(trim($period));
        if (! in_array($period, ['daily', 'weekly', 'monthly', 'yearly'], true)) {
            throw new \InvalidArgumentException('Invalid period. Allowed: daily, weekly, monthly, yearly');
        }

        $fromTs = strtotime($from);
        $toTs = strtotime($to);
        if ($fromTs === false || $toTs === false) {
            throw new \InvalidArgumentException('Invalid from/to date format. Use ISO date (YYYY-MM-DD).');
        }
        if ($fromTs > $toTs) {
            throw new \InvalidArgumentException('Invalid range: from must be earlier than or equal to to.');
        }

        return $this->instrumentDataRepository->getHistoryRange(
            $symbol,
            $period,
            date('Y-m-d H:i:s', $fromTs),
            date('Y-m-d H:i:s', $toTs)
        );
    }
}