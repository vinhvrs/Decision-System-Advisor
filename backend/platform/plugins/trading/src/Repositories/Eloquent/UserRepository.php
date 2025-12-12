<?php
namespace Platform\Plugins\Trading\Src\Repositories\Eloquent;

use Platform\Plugins\Trading\Src\Models\Users;
use Platform\Plugins\Trading\Src\Repositories\Interfaces\UserInterface;
use Illuminate\Pagination\LengthAwarePaginator;

class UserRepository implements UserInterface {
    public function create(array $user): Users {
        $user['password'] = bcrypt($user['password']);
        return Users::create($user);
    }

    public function find(string $id): ?Users {
        return Users::find($id);
    }

    public function findAll($filter, $select, $perPage): LengthAwarePaginator {
        $query = Users::query()->orderByDesc('updated_at');

        if (!empty($filter)) {
            foreach ($filter as $field => $value) {
                $query->where($field, 'LIKE', "%$value%");
            }
        }

        if (!empty($select)) {
            $query->select($select);
        }

        return $query->paginate($perPage);
    }

    public function update(string $id, array $user): ?Users {
        $usr = Users::find($id);
        if ($usr) {
            $usr->update($user);
            return $usr;
        }
        return null;
    }

    public function delete(string $id): bool {
        $usr = Users::find($id);
        if ($usr) {
            return (bool)$usr->delete();
        }
        return false;
    }
}