<?php

namespace Platform\Plugins\Advisor\Src\Http\Controllers;

use Illuminate\Http\Request;
use Platform\Plugins\Advisor\Src\Services\ElasticsearchEntityService;
use App\Http\Controllers\Controller;

class ElasticEntityController extends Controller
{
    public function __construct(private readonly ElasticsearchEntityService $es)
    {
    }

    // POST /api/entities/import
    public function import(Request $request)
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.type' => ['required', 'string'], // company | indicator
            'items.*.symbol' => ['nullable', 'string'],
            'items.*.name' => ['required', 'string'],
            'items.*.aliases' => ['nullable', 'array'],
            'items.*.aliases.*' => ['string'],
            'items.*.fuzzy_aliases' => ['nullable', 'array'],
            'items.*.fuzzy_aliases.*' => ['string'],
            'items.*.priority' => ['nullable', 'integer'],
        ]);

        return response()->json($this->es->import($data['items']));
    }

    // GET /api/entities/resolve?q=aple&type=company
    public function resolve(Request $request)
    {
        $data = $request->validate([
            'q' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string'], // company|indicator
            'size' => ['nullable', 'integer', 'min:1', 'max:10'],
        ]);

        $type = $data['type'] ?? 'company';
        $size = $data['size'] ?? 5;

        return response()->json($this->es->resolve($data['q'], $type, $size));
    }
}
