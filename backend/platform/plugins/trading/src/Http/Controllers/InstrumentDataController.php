<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\InstrumentDataRepository;
use Platform\Plugins\Trading\Src\Services\PeriodClassifyService;
use Platform\Plugins\Trading\Src\Services\InstrumentService;

class InstrumentDataController extends Controller{
    protected $instrumentDataRepository;
    protected $instrumentService;

    public function __construct(InstrumentDataRepository $instrumentDataRepository, InstrumentService $instrumentService) {
        $this->instrumentDataRepository = $instrumentDataRepository;
        $this->instrumentService = $instrumentService;
    }

    public function index(Request $request) {
        $filter = $request->input('filter', []);
        $select = $request->input('select', ['*']);
        $perPage = min(max((int) $request->input('per_page', 15), 1), 500);

        $data = $this->instrumentDataRepository->findAll($filter, $select, $perPage);
        return response()->json($data);
    }

    public function get(Request $request, $symbol) {
        $period = $request->input('period', 'daily');
        $perPage = min(max((int) $request->input('per_page', 500), 1), 5000);
        $page = max((int) $request->input('page', 1), 1);

        $data = $this->instrumentService->show($symbol, $period, $perPage, $page);
        return response()->json($data);
     }

    public function getHistory(Request $request, string $symbol)
    {
        $period = strtolower((string) $request->query('period', 'daily'));
        $from = (string) $request->query('from', '');
        $to = (string) $request->query('to', '');

        if ($from === '') {
            return response()->json([
                'message' => 'Missing required query parameter: from',
            ], 422);
        }
        if ($to === '') {
            $to = now()->toDateTimeString();
        }

        try {
            $data = $this->instrumentService->history($symbol, $period, $from, $to);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['data' => $data]);
    }

    /**
     * POST JSON: { "symbols": ["NVDA","AAPL"], "limit": 40 } — daily closes per symbol (oldest first).
     */
    public function batchDailyCloses(Request $request)
    {
        $symbols = $request->input('symbols');
        if (! is_array($symbols)) {
            return response()->json(['message' => 'symbols must be an array of ticker strings'], 422);
        }
        $limit = min(max((int) $request->input('limit', 40), 1), 500);
        $period = strtolower((string) $request->input('period', 'daily'));
        if (! in_array($period, ['daily', 'yearly'], true)) {
            $period = 'daily';
        }
        $symbols = array_slice(array_values($symbols), 0, 100);
        $data = $this->instrumentDataRepository->batchDailyCloses($symbols, $limit, $period);

        return response()->json(['data' => $data]);
    }

    public function showByPeriod(string $periodId) {
        $perPage = min(max((int) request()->input('per_page', 500), 1), 10000);

        $data = $this->instrumentDataRepository->findByPeriod($periodId, $perPage);
        if ($data) {
            return response()->json($data);
        }

        return response()->json(['message' => 'Instrument data not found'], 404);
    }

    public function show($id) {
        $data = $this->instrumentDataRepository->find($id);
        if ($data) {
            return response()->json($data);
        }
        return response()->json(['message' => 'Instrument data not found'], 404);
    }

    public function store(Request $request) {
        $data = $request->all();
        $instrumentData = $this->instrumentDataRepository->create($data);
        return response()->json($instrumentData, 201);
    }

    public function update(Request $request, $id) {
        $data = $request->all();
        $instrumentData = $this->instrumentDataRepository->update($id, $data);
        if ($instrumentData) {
            return response()->json($instrumentData);
        }
        return response()->json(['message' => 'Instrument data not found'], 404);
    }

    // public function destroy($id) {
    //     $deleted = $this->instrumentDataRepository->delete($id);
    //     if ($deleted) {
    //         return response()->json(['message' => 'Instrument data deleted successfully']);
    //     }
    //     return response()->json(['message' => 'Instrument data not found'], 404);
    // }

    // Additional method to classify periods
    public function classifyPeriods(Request $request, $symbol) {
        $data = $request->all();
        $service = new PeriodClassifyService($this->instrumentDataRepository);
        $classifiedData = $service->classifyPeriods($symbol, $data['basePeriod'] ?? 'daily');
        return response()->json($classifiedData);
    }
}