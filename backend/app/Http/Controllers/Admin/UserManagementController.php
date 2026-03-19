<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\UserManagementService;
use Illuminate\Http\Request;

class UserManagementController extends Controller
{
    public function __construct(
        protected UserManagementService $userService
    ) {
    }

    public function index(Request $request)
    {
        $filters = $request->only(['role', 'search']);
        $filters = array_filter($filters, fn ($v) => $v !== null && $v !== '');
        $perPage = (int) $request->input('per_page', 15);
        $page = $request->has('page') ? (int) $request->input('page') : null;

        $users = $this->userService->list($filters, $perPage, $page);
        return response()->json($users);
    }

    public function show(string $id)
    {
        $user = $this->userService->find($id);
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }
        return response()->json($user);
    }

    public function updateRole(Request $request, string $id)
    {
        $validated = $request->validate(['role' => 'required|in:admin,staff,paid,unpaid']);

        $user = $this->userService->updateRole($id, $validated['role']);
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }
        return response()->json($user);
    }

    public function update(Request $request, string $id)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email',
            'phone' => 'nullable|string|max:15',
            'role' => 'sometimes|in:admin,staff,paid,unpaid',
        ]);

        $user = $this->userService->update($id, $validated);
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }
        return response()->json($user);
    }
}
