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
        $perPage = $request->input('per_page', 15);

        $data = $this->instrumentDataRepository->findAll($filter, $select, $perPage);
        return response()->json($data);
    }

    public function get(Request $request, $symbol) {
        $period = $request->input('period', 'daily');
        $perPage = $request->input('per_page', 15);
        $page = $request->input('page', 1);

        $data = $this->instrumentService->show($symbol, $period, $perPage, $page);
        return response()->json($data);
     }

    public function showByPeriod($periodId) {
        set_time_limit(0);
        $perPage = request()->input('per_page', 15);
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