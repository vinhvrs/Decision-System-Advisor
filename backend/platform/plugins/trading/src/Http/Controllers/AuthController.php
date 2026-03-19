<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\UserRepository;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
class AuthController extends Controller
{
    protected $userRepository;

    public function __construct(UserRepository $userRepository)
    {
        $this->userRepository = $userRepository;
    }

    public function register(Request $request)
    {
        $data = $request->only(['name', 'username', 'email', 'phone', 'password']);
        $user = $this->userRepository->create($data);
        return response()->json($user, 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->only(['email', 'password']);
        $remember = $request->boolean('remember', true);

        if (Auth::attempt($credentials, $remember)) {
            $user = Auth::user();

            // Delete existing tokens for this user (renew on login)
            $user->tokens()->delete();

            // Create token with 7-day TTL
            $token = $user->createToken('authToken', ['*'], now()->addDays(7))->plainTextToken;

            $response = response()->json([
                'token' => $token,
                'user' => $user,
            ], 200);

            // Set remember cookie (7 days) for quick re-login
            if ($remember) {
                $response->cookie('dsa_remember', $token, 7 * 24 * 60, '/', null, false, true);
            }

            return $response;
        }

        return response()->json(['error' => 'Unauthorized'], 401);
    }

    public function logout(Request $request)
    {
        if ($request->user()) {
            $request->user()->tokens()->delete();
        }
        $response = response()->json(['message' => 'Successfully logged out'], 200);
        $response->cookie('dsa_remember', '', 0, '/', null, false, true);
        return $response;
    }

}
