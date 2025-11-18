<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\StockRepository;


class StockController extends Controller{
    protected $stockRepository;

    public function __construct(StockRepository $stockRepository) {
        $this->stockRepository = $stockRepository;
    }

    public function index(Request $request){
        $attributes = $this->stockRepository->findAll(
            $request->input('filter', []),
            $request->input('select', ['*']),
            $request->input('per_page', 15)
        );
        return response()->json($attributes);
    }

    public function show($id){
        $attribute = $this->stockRepository->find($id);
        return response()->json($attribute);
    }
    public function store(Request $request){
        $data = $request->only(['instrument_id', 'attribute_name', 'attribute_value']);
        $attribute = $this->stockRepository->create($data);
        return response()->json($attribute, 201);
    }

    public function update(Request $request, $id){
        $data = $request->only(['instrument_id', 'attribute_name', 'attribute_value']);
        $attribute = $this->stockRepository->update($id, $data);
        return response()->json($attribute);
    }

    public function destroy($id){
        $deleted = $this->stockRepository->delete($id);
        return response()->json(['deleted' => $deleted]);
    }
}
