<?php

namespace Platform\Plugins\Trading\Src\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\EmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\UserRepository;
use Throwable;

class AuthController extends Controller
{
    public function __construct(
        protected UserRepository $userRepository,
        protected EmailService $emailService
    ) {}

    /**
     * Step 1: send 6-digit OTP to email; pending registration stored 15 minutes.
     */
    public function registerRequestOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'username' => ['required', 'string', 'max:50', Rule::unique('users', 'username')],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $email = strtolower(trim($validated['email']));
        $otp = $this->generateOtp();

        Cache::put(
            'auth_reg_pending:'.$email,
            [
                'name' => $validated['name'],
                'username' => $validated['username'],
                'password_hash' => Hash::make($validated['password']),
            ],
            now()->addMinutes(15)
        );
        Cache::put('auth_reg_otp:'.$email, password_hash($otp, PASSWORD_BCRYPT), now()->addMinutes(15));

        $app = config('app.name', 'DSA');
        try {
            $this->emailService->sendPlain(
                $email,
                "[{$app}] Your registration code",
                "Your verification code is: {$otp}\n\nIt expires in 15 minutes.\n\nIf you did not request this, ignore this email."
            );
        } catch (Throwable $e) {
            Log::error('register OTP mail failed: '.$e->getMessage());

            return response()->json([
                'message' => 'Could not send email. Check mail configuration or try again later.',
            ], 503);
        }

        return response()->json([
            'message' => 'Verification code sent to your email.',
            'email' => $email,
        ], 200);
    }

    /**
     * Step 2: verify OTP and create account.
     */
    public function registerVerify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'otp' => ['required', 'string', 'size:6'],
        ]);

        $email = strtolower(trim($validated['email']));
        $pending = Cache::pull('auth_reg_pending:'.$email);
        $otpHash = Cache::get('auth_reg_otp:'.$email);

        if (! $pending || ! $otpHash || ! password_verify($validated['otp'], $otpHash)) {
            return response()->json(['message' => 'Invalid or expired code. Request a new one.'], 422);
        }

        Cache::forget('auth_reg_otp:'.$email);

        try {
            $user = $this->userRepository->createWithHashedPassword([
                'name' => $pending['name'],
                'username' => $pending['username'],
                'email' => $email,
                'password' => $pending['password_hash'],
                'email_verified_at' => now(),
            ]);
        } catch (Throwable $e) {
            Log::error('register verify create failed: '.$e->getMessage());

            return response()->json(['message' => 'Registration failed. Try again.'], 500);
        }

        $user->tokens()->delete();
        $token = $user->createToken('authToken', ['*'], now()->addDays(7))->plainTextToken;

        return response()->json([
            'message' => 'Registration complete.',
            'token' => $token,
            'user' => $user,
        ], 201);
    }

    /**
     * Step 1 forgot password: send OTP (always same response text for privacy).
     */
    public function forgotPasswordRequest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $email = strtolower(trim($validated['email']));
        $user = $this->userRepository->findByEmail($email);

        $message = 'If an account exists for that email, a verification code was sent.';

        if (! $user) {
            return response()->json(['message' => $message], 200);
        }

        $otp = $this->generateOtp();
        Cache::put('auth_forgot_otp:'.$email, password_hash($otp, PASSWORD_BCRYPT), now()->addMinutes(15));

        $app = config('app.name', 'DSA');
        try {
            $this->emailService->sendPlain(
                $email,
                "[{$app}] Password reset code",
                "Your password reset code is: {$otp}\n\nIt expires in 15 minutes.\n\nIf you did not request this, ignore this email."
            );
        } catch (Throwable $e) {
            Log::error('forgot OTP mail failed: '.$e->getMessage());
            Cache::forget('auth_forgot_otp:'.$email);

            return response()->json([
                'message' => 'Could not send email. Check mail configuration or try again later.',
            ], 503);
        }

        return response()->json(['message' => $message], 200);
    }

    /**
     * Step 2: verify OTP, set random 10-digit password, email it, prompt password change.
     */
    public function forgotPasswordVerify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'otp' => ['required', 'string', 'size:6'],
        ]);

        $email = strtolower(trim($validated['email']));
        $user = $this->userRepository->findByEmail($email);
        $otpHash = Cache::get('auth_forgot_otp:'.$email);

        if (! $user || ! $otpHash || ! password_verify($validated['otp'], $otpHash)) {
            return response()->json(['message' => 'Invalid or expired code.'], 422);
        }

        Cache::forget('auth_forgot_otp:'.$email);

        $tempPassword = $this->generateTempPassword10();
        $this->userRepository->update($user->id, [
            'password' => Hash::make($tempPassword),
        ]);
        $user->tokens()->delete();

        $app = config('app.name', 'DSA');
        $baseUrl = rtrim((string) config('app.url', ''), '/');
        $changeUrl = $baseUrl.'/auth/new-password';

        try {
            $this->emailService->sendPlain(
                $email,
                "[{$app}] Temporary password",
                "Your temporary password (10 digits): {$tempPassword}\n\n"
                ."Sign in with this password, then change it immediately.\n"
                ."Set a new password here: {$changeUrl}\n\n"
                ."This is a random code — do not reuse it as your long-term password."
            );
        } catch (Throwable $e) {
            Log::error('temp password mail failed: '.$e->getMessage());
        }

        return response()->json([
            'message' => 'Temporary password sent to your email. Change it after signing in.',
            'redirect' => '/auth/new-password',
            'must_change_password' => true,
        ], 200);
    }

    /**
     * Replace temp password while logged out: email + current password + new password.
     */
    public function resetPasswordFromTemp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $email = strtolower(trim($validated['email']));
        $user = $this->userRepository->findByEmail($email);

        if (! $user || ! Hash::check($validated['current_password'], $user->password)) {
            return response()->json(['message' => 'Invalid email or current password.'], 422);
        }

        $this->userRepository->update($user->id, [
            'password' => Hash::make($validated['password']),
        ]);

        return response()->json(['message' => 'Password updated. You can sign in with your new password.'], 200);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->only(['email', 'password']);
        $remember = $request->boolean('remember', true);

        if (Auth::attempt($credentials, $remember)) {
            $user = Auth::user();

            $user->tokens()->delete();

            $token = $user->createToken('authToken', ['*'], now()->addDays(7))->plainTextToken;

            $response = response()->json([
                'token' => $token,
                'user' => $user,
            ], 200);

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

    protected function generateOtp(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    protected function generateTempPassword10(): string
    {
        return sprintf('%010d', random_int(0, 9999999999));
    }
}
