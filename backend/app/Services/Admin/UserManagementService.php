<?php

namespace App\Services\Admin;

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Platform\Plugins\Trading\Src\Models\Users;

class UserManagementService
{
    public function list(array $filters = [], int $perPage = 15, ?int $page = null): LengthAwarePaginator
    {
        $query = Users::query()
            ->select(['id', 'username', 'name', 'email', 'phone', 'role', 'updated_at', 'created_at'])
            ->orderByDesc('updated_at');

        if (!empty($filters['role'])) {
            $query->where('role', $filters['role']);
        }
        if (!empty($filters['search'])) {
            $q = $filters['search'];
            $query->where(function ($qry) use ($q) {
                $qry->where('name', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%")
                    ->orWhere('username', 'like', "%{$q}%");
            });
        }

        return $query->paginate($perPage, ['*'], 'page', $page);
    }

    public function find(string $id): ?Users
    {
        return Users::find($id);
    }

    public function updateRole(string $id, string $role): ?Users
    {
        $allowed = ['admin', 'staff', 'paid', 'unpaid'];
        if (!in_array($role, $allowed, true)) {
            return null;
        }

        $user = Users::find($id);
        if (!$user) {
            return null;
        }

        $user->update(['role' => $role]);
        return $user;
    }

    public function update(string $id, array $data): ?Users
    {
        $user = Users::find($id);
        if (!$user) {
            return null;
        }

        $allowed = ['name', 'email', 'phone', 'role'];
        $payload = array_intersect_key($data, array_flip($allowed));
        if (!empty($payload)) {
            $user->update($payload);
        }
        return $user;
    }
}
