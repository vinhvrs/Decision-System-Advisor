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
}