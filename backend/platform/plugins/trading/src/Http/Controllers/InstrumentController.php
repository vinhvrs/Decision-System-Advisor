<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\InstrumentRepository;
use GuzzleHttp\Client;

class InstrumentController extends Controller{
    protected $instrumentRepository;

    protected $mapFinnHubToInstrument = [
        'name' => 'description',
        'symbol' => 'symbol',
        'type' => 'type',
        'exchange' => 'mic'
    ];

    protected $micMap = [
        'XNAS' => 'NASDAQ',
        'XNYS' => 'NYSE',
        'XASE' => 'AMEX',
        'ARCX' => 'NYSE Arca',
        'BATS' => 'Cboe BATS',
        'OOTC' => 'OTC Markets',
        'XNGS' => 'NASDAQ Global Select',
        'XNCM' => 'NASDAQ Capital Market',
        'XNMS' => 'NASDAQ Global Market',
    ];

    public function __construct(InstrumentRepository $instrumentRepository) {
        $this->instrumentRepository = $instrumentRepository;
    }

    public function mapFinnHubDataToInstrument(array $finnHubData): array {
        $mappedData = [];
        foreach ($this->mapFinnHubToInstrument as $instrumentField => $finnHubField) {
            if (isset($finnHubData[$finnHubField])) {
                $mappedData[$instrumentField] = $finnHubData[$finnHubField];
            }
        }

        // Map MIC to full exchange name if available
        if (isset($mappedData['exchange']) && isset($this->micMap[$mappedData['exchange']])) {
            $mappedData['exchange'] = $this->micMap[$mappedData['exchange']];
        }
        
        foreach ($mappedData as $key => $value) {
            if (is_string($value)) {
                $mappedData[$key] = trim($value);
            }
            $mappedData['type'] = 'stock';
            $mappedData['slug'] = strtolower(str_replace(' ', '-', ($mappedData['name'] . $mappedData['symbol'])));

        }
        
        return $mappedData;
    }

    public function fetchListStock() {
        try {
            $url = "https://finnhub.io/api/v1/stock/symbol?exchange=US&token=d4d2r4hr01qt1lahh29gd4d2r4hr01qt1lahh2a0";
            $client = new Client();
            $response = $client->get($url)->getBody()->getContents();

            $data = json_decode($response, true);
            $results = array_map([$this, 'mapFinnHubDataToInstrument'], $data);

            $this->instrumentRepository->insert($results);

            return response()->json(['message' => 'Stock list fetched and stored successfully', 'count' => count($results)]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch stock list', 'message' => $e->getMessage()], 500);
        }
       
    }

    public function index(Request $request){
        $instruments = $this->instrumentRepository->findAll(
            $request->input('filter', []),
            $request->input('select', ['*']),
            $request->input('per_page', 15),
            $request->input('page', 1),
            $request->input('order_by', 'symbol')
        );
        return response()->json($instruments);
    }

    public function show($id){
        $instrument = $this->instrumentRepository->find($id);
        return response()->json($instrument);
    }
    public function store(Request $request){
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'symbol' => 'required|string|max:10|unique:instruments,symbol',
            'type' => 'required|string|max:50',
            'exchange' => 'required|string|max:50',
            'slug' => 'required|string|max:255'
        ]);
        $instrument = $this->instrumentRepository->create($data);
        return response()->json($instrument, 201);
    }

    public function update(Request $request, $id){
        $data = $request->only(['name', 'type', 'market']);
        $instrument = $this->instrumentRepository->update($id, $data);
        return response()->json($instrument);
    }

    public function destroy($id){
        $deleted = $this->instrumentRepository->delete($id);
        return response()->json(['deleted' => $deleted]);
    }
}