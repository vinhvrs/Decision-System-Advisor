<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\StockRepository;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\InstrumentRepository;
use Platform\Plugins\Trading\Src\Services\StockService;
use Illuminate\Support\Facades\Log;

class StockController extends Controller
{
    protected $stockRepository;
    protected $stockService;
    protected $instrumentRepository;

    public function __construct(StockRepository $stockRepository, StockService $stockService, InstrumentRepository $instrumentRepository)
    {
        $this->stockRepository = $stockRepository;
        $this->stockService = $stockService;
        $this->instrumentRepository = $instrumentRepository;
    }

    public function expertAdvices(Request $request, string $symbol)
    {
        $result = $this->stockService->ExpertAdvices($symbol);
        return $result;
    }

    public function index(Request $request)
    {
        $attributes = $this->stockRepository->findAll(
            $request->input('filter', []),
            $request->input('select', ['*']),
            $request->input('per_page', 15)
        );
        return response()->json($attributes);
    }

    public function show($id)
    {
        $attribute = $this->stockRepository->find($id);
        return response()->json($attribute);
    }

    public function showByName($name)
    {
        $instrument_id = $this->instrumentRepository->likeByField('name', $name)->id ?? null;
        $attribute = $this->stockRepository->findByField('instrument_id', $instrument_id);
        if (!$attribute || $attribute->updated_at->diffInHours(now()) >= 1) {
            Log::info("Importing attributes for instrument_id: " . $instrument_id);
            $attribute = $this->stockRepository->findByField('instrument_id', $instrument_id);
        }
        return response()->json($attribute);
    }

    public function showBySymbol($symbol)
    {
        $instrument_id = $this->instrumentRepository->findByField('symbol', $symbol)->id ?? null;
        $attribute = $this->stockRepository->findByField('instrument_id', $instrument_id);
        if (!$attribute || $attribute->updated_at->diffInHours(now()) >= 1) {
            Log::info("Importing attributes for instrument_id: " . $instrument_id);
            $attribute = $this->stockRepository->findByField('instrument_id', $instrument_id);
        }
        return response()->json($attribute);
    }

    public function store(Request $request)
    {
        $data = $request->only(['instrument_id', 'attribute_name', 'attribute_value']);
        $attribute = $this->stockRepository->create($data);
        return response()->json($attribute, 201);
    }

    public function update(Request $request, $id)
    {
        $data = $request->only(['instrument_id', 'attribute_name', 'attribute_value']);
        $attribute = $this->stockRepository->update($id, $data);
        return response()->json($attribute);
    }

    public function destroy($id)
    {
        $deleted = $this->stockRepository->delete($id);
        return response()->json(['deleted' => $deleted]);
    }
}
