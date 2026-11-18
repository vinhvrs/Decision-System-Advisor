<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PriceAlertController extends Controller
{
    public function index(Request $request) {
        return response()->json(['data' => DB::table('price_alerts')
            ->where('user_id', $request->user()->id)
            ->orderByRaw("CASE WHEN status='active' THEN 0 WHEN read_at IS NULL THEN 1 ELSE 2 END")
            ->orderByDesc('created_at')->limit(150)->get()]);
    }

    public function store(Request $request) {
        $request->merge(['symbol' => strtoupper(trim((string) $request->input('symbol')))]);
        $data = $request->validate([
            'symbol' => ['required', 'string', 'max:16', Rule::exists('market_assets', 'symbol')->where('enabled', 1)],
            'direction' => ['required', Rule::in(['above', 'below'])],
            'target_price' => ['required', 'numeric', 'decimal:0,10', 'min:0.0000000001', 'max:9999999999.9999999999'],
        ]);
        $userId = $request->user()->id;
        $row = DB::transaction(function () use ($data, $userId) {
            // Serialize creations per user: both duplicate checks and the active limit are race safe.
            DB::table('users')->where('id', $userId)->lockForUpdate()->first();
            $query = DB::table('price_alerts')->where('user_id', $userId)->where('status', 'active');
            $existing = (clone $query)->where('symbol', $data['symbol'])->where('direction', $data['direction'])
                ->where('target_price', $data['target_price'])->first();
            if ($existing) return $existing;
            abort_if($query->count() >= 50, 422, 'Maximum 50 active alerts per account.');
            abort_if(DB::table('price_alerts')->where('status', 'active')->count() >= 2000, 429, 'Alert capacity reached. Try again later.');
            $id = (string) Str::uuid();
            DB::table('price_alerts')->insert([...$data, 'id' => $id, 'user_id' => $userId,
                'status' => 'active', 'created_at' => now('UTC'), 'updated_at' => now('UTC')]);
            return DB::table('price_alerts')->where('id', $id)->first();
        });
        return response()->json(['data' => $row], 201);
    }

    public function destroy(Request $request, string $id) {
        $count = DB::table('price_alerts')->where('id', $id)->where('user_id', $request->user()->id)->delete();
        abort_if(!$count, 404);
        return response()->json(['deleted' => true]);
    }

    public function read(Request $request, string $id) {
        $row = DB::table('price_alerts')->where('id', $id)->where('user_id', $request->user()->id)->first();
        abort_if(!$row, 404);
        if ($row->status === 'triggered' && !$row->read_at) {
            DB::table('price_alerts')->where('id', $id)->where('user_id', $request->user()->id)->update(['read_at' => now('UTC')]);
        }
        return response()->json(['ok' => true]);
    }
}
