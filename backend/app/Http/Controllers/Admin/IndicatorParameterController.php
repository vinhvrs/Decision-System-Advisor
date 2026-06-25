<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Indicator;
use App\Models\IndicatorParameter;
use App\Services\IndicatorConfigService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class IndicatorParameterController extends Controller
{
    public function __construct(private readonly IndicatorConfigService $indicatorConfig)
    {
    }

    public function catalog()
    {
        $rows = Indicator::query()
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'description']);

        return response()->json(['data' => $rows]);
    }

    public function index(string $indicatorId)
    {
        $indicator = Indicator::query()->whereKey($indicatorId)->first();
        if (! $indicator) {
            return response()->json(['message' => 'Indicator not found'], 404);
        }

        $params = IndicatorParameter::query()
            ->where('indicator_id', $indicatorId)
            ->orderBy('sort_order')
            ->orderBy('param_key')
            ->get();

        return response()->json([
            'data' => [
                'indicator' => $indicator,
                'parameters' => $params,
            ],
        ]);
    }

    public function store(Request $request, string $indicatorId)
    {
        $indicator = Indicator::query()->whereKey($indicatorId)->first();
        if (! $indicator) {
            return response()->json(['message' => 'Indicator not found'], 404);
        }

        $validated = $request->validate([
            'param_key' => ['required', 'string', 'max:120', Rule::regex('/^[A-Za-z0-9._-]+$/')],
            'param_value' => ['nullable', 'string', 'max:65535'],
            'value_type' => ['required', Rule::in(['string', 'number', 'boolean', 'json'])],
            'label' => ['nullable', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:5000'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:999999'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $exists = IndicatorParameter::query()
            ->where('indicator_id', $indicatorId)
            ->where('param_key', $validated['param_key'])
            ->exists();
        if ($exists) {
            return response()->json(['message' => 'A parameter with this key already exists for this indicator.'], 422);
        }

        $row = IndicatorParameter::query()->create([
            'indicator_id' => $indicatorId,
            'param_key' => $validated['param_key'],
            'param_value' => $validated['param_value'] ?? null,
            'value_type' => $validated['value_type'],
            'label' => $validated['label'] ?? null,
            'description' => $validated['description'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $this->indicatorConfig->flushCache();

        return response()->json(['data' => $row], 201);
    }

    public function update(Request $request, string $indicatorId, string $parameterId)
    {
        $row = IndicatorParameter::query()
            ->where('indicator_id', $indicatorId)
            ->whereKey($parameterId)
            ->first();
        if (! $row) {
            return response()->json(['message' => 'Parameter not found'], 404);
        }

        $validated = $request->validate([
            'param_key' => ['sometimes', 'string', 'max:120', Rule::regex('/^[A-Za-z0-9._-]+$/')],
            'param_value' => ['nullable', 'string', 'max:65535'],
            'value_type' => ['sometimes', Rule::in(['string', 'number', 'boolean', 'json'])],
            'label' => ['nullable', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:5000'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:999999'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($validated['param_key']) && $validated['param_key'] !== $row->param_key) {
            $dup = IndicatorParameter::query()
                ->where('indicator_id', $indicatorId)
                ->where('param_key', $validated['param_key'])
                ->where('id', '!=', $row->id)
                ->exists();
            if ($dup) {
                return response()->json(['message' => 'Another parameter already uses this key.'], 422);
            }
        }

        $row->fill($validated);
        $row->save();

        $this->indicatorConfig->flushCache();

        return response()->json(['data' => $row->fresh()]);
    }

    public function destroy(string $indicatorId, string $parameterId)
    {
        $deleted = IndicatorParameter::query()
            ->where('indicator_id', $indicatorId)
            ->whereKey($parameterId)
            ->delete();

        if (! $deleted) {
            return response()->json(['message' => 'Parameter not found'], 404);
        }

        $this->indicatorConfig->flushCache();

        return response()->json(['message' => 'Deleted']);
    }
}
