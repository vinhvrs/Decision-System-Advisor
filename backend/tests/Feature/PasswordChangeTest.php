<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Platform\Plugins\Trading\Src\Models\Users;
use Tests\TestCase;

class PasswordChangeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('username', 50)->unique();
            $table->string('password');
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone', 15)->nullable();
            $table->string('role')->default('unpaid');
            $table->timestamp('email_verified_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('personal_access_tokens', function (Blueprint $table): void {
            $table->id();
            $table->string('tokenable_type');
            $table->string('tokenable_id');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    private function user(): Users
    {
        return Users::create([
            'username' => 'password-test-user',
            'password' => Hash::make('Current123'),
            'name' => 'Password Test',
            'email' => 'password-test@example.com',
            'role' => 'unpaid',
        ]);
    }

    public function test_authenticated_user_can_change_password_and_tokens_are_revoked(): void
    {
        $user = $this->user();
        $user->createToken('existing-session');
        Sanctum::actingAs($user, ['*']);

        $response = $this->postJson('/api/auth/password/change', [
            'current_password' => 'Current123',
            'password' => 'NewPassword456',
            'password_confirmation' => 'NewPassword456',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('message', 'Password updated. Sign in again with your new password.');

        $user->refresh();
        $this->assertTrue(Hash::check('NewPassword456', $user->password));
        $this->assertFalse(Hash::check('Current123', $user->password));
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_wrong_current_password_is_rejected(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user, ['*']);

        $this->postJson('/api/auth/password/change', [
            'current_password' => 'Wrong123',
            'password' => 'NewPassword456',
            'password_confirmation' => 'NewPassword456',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Current password is incorrect.');

        $user->refresh();
        $this->assertTrue(Hash::check('Current123', $user->password));
    }

    public function test_weak_new_password_is_rejected(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user, ['*']);

        $this->postJson('/api/auth/password/change', [
            'current_password' => 'Current123',
            'password' => 'abcdefgh',
            'password_confirmation' => 'abcdefgh',
        ])->assertStatus(422);

        $user->refresh();
        $this->assertTrue(Hash::check('Current123', $user->password));
    }
}
