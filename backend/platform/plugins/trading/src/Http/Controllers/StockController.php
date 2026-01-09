<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\StockRepository;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\InstrumentRepository;
use Platform\Plugins\Trading\Src\Services\StockService;
use Platform\Plugins\Trading\Src\Models\StockAttribute;
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

    public function calculateAttribute(Request $request, string $instrumentId)
    {
        $symbol = $this->instrumentRepository->find($instrumentId)->symbol;
        $result = $this->stockService->calculate($symbol);
        return $result;
    }
    public function importAttributes(Request $request, string $instrumentId)
    {
        $symbol = $this->instrumentRepository->find($instrumentId)->symbol;

        // StockService trả về JsonResponse
        $result = $this->stockService->calculate($symbol);
        // Convert response -> array
        $resultArr = $result->getData(true);
        Log::info("Importing stock attributes for symbol: " . $symbol, $resultArr);

        if (!isset($resultArr['data']) || !is_array($resultArr['data'])) {
            Log::error("Invalid data format received for symbol: " . $symbol, $resultArr);
            return response()->json(['error' => 'Invalid data format'], 500);
        }

        $rawData = $resultArr['data'];
        $data = $rawData['details'] ?? [];
        if (empty($data)) {
            return response()->json(['error' => 'No data to import'], 500);
        }
        // Fillable
        $fillable = (new StockAttribute)->getFillable();

        $payload = [];

        foreach ($fillable as $field) {

            // Auto-generate
            if ($field === 'id')
                continue;

            if ($field === 'instrument_id') {
                $payload[$field] = $instrumentId;
                continue;
            }

            if ($field === 'date') {
                $payload[$field] = now()->toDateString();
                continue;
            }

            // ⭐ FIX: Xử lý riêng recommendation
            if ($field === 'recommendation') {

                $rec = $data['recommendation'] ?? 'Hold';

                // Nếu API trả object => lấy giá trị đầu tiên
                if (is_array($rec)) {
                    $rec = reset($rec);
                }

                // Nếu vẫn không phải string => fallback
                if (!is_string($rec)) {
                    $rec = 'Hold';
                }

                $payload[$field] = $rec;
                continue;
            }

            // Normal fields
            $payload[$field] = $data[$field] ?? 0;
        }

        $record = $this->stockRepository->createOrUpdate($payload);

        return response()->json([
            'imported' => true,
            'data' => $record
        ]);
    }

    public function indicatorSummary(Request $request, string $symbol)
    {
        $period = $request->query('period', 'daily');

        // Validate period
        $allowed = ['daily', 'weekly', 'monthly', 'yearly'];
        if (!in_array($period, $allowed, true)) {
            return response()->json([
                'error' => 'Invalid period',
                'allowed_periods' => $allowed,
            ], 422);
        }
        // StockService already returns JsonResponse
        return $this->stockService->indicatorSummary($symbol, $period);
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
            $this->importAttributes(new Request(), $instrument_id);
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
            $this->importAttributes(new Request(), $instrument_id);
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
