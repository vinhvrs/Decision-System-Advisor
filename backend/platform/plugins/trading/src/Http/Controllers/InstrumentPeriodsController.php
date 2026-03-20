<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\InstrumentPeriodsRepository;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\InstrumentRepository;
use Platform\Plugins\Trading\Src\Models\InstrumentPeriods;


class InstrumentPeriodsController extends Controller{
    protected $instrumentPeriodsRepository;
    protected $instrumentRepository;

    protected array $periods = ['daily', 'weekly', 'monthly', 'yearly'];

    public function __construct(InstrumentPeriodsRepository $instrumentPeriodsRepository, InstrumentRepository $instrumentRepository) {
        $this->instrumentPeriodsRepository = $instrumentPeriodsRepository;
        $this->instrumentRepository = $instrumentRepository;
    }

    public function generate()
    {
                set_time_limit(0);

        // Lấy toàn bộ instruments KHÔNG phân trang
        $instruments = $this->instrumentRepository->findAll([], ['*'], 99999, 1, null)->items();

        $createdCount = 0;

        foreach ($instruments as $instrument) {
            $symbol = strtolower($instrument->symbol);

            foreach ($this->periods as $period) {

                $slug = "{$symbol}-{$period}";

                // Avoid duplicates
                $exists = $this->instrumentPeriodsRepository->where('instrument_id', $instrument->id)
                    ->where('period', $period)
                    ->exists();

                if ($exists) continue;

                $this->instrumentPeriodsRepository->create([
                    'instrument_id' => $instrument->id,
                    'period' => $period,
                    'market' => 'stock',
                    'prefix' => $symbol,
                    'slug' => $slug,
                ]);

                $createdCount++;
            }
        }

        return response()->json([
            'message' => 'Instrument periods generated successfully',
            'created' => $createdCount
        ]);
    }

    public function index(Request $request) {
        $filter = $request->input('filter', []);
        $select = $request->input('select', ['*']);
        $perPage = $request->input('per_page', 15);

        $instrumentPeriods = $this->instrumentPeriodsRepository->findAll($filter, $select, $perPage);

        return response()->json($instrumentPeriods);
    }

    public function show(string $id)
    {
        $rows = InstrumentPeriods::query()
            ->where('instrument_id', $id)
            ->orderBy('period')
            ->select(['id', 'instrument_id', 'period', 'market', 'slug', 'prefix', 'created_at', 'updated_at'])
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request) {
        $data = $request->all();
        $instrumentPeriod = $this->instrumentPeriodsRepository->create($data);

        return response()->json($instrumentPeriod, 201);
    }

    public function update(Request $request, $id) {
        $data = $request->all();
        $instrumentPeriod = $this->instrumentPeriodsRepository->update($id, $data);

        if (!$instrumentPeriod) {
            return response()->json(['message' => 'Instrument Period not found'], 404);
        }

        return response()->json($instrumentPeriod);
    }

    public function destroy($id) {
        $deleted = $this->instrumentPeriodsRepository->delete($id);

        if (!$deleted) {
            return response()->json(['message' => 'Instrument Period not found'], 404);
        }

        return response()->json(['message' => 'Instrument Period deleted successfully']);
    }
}